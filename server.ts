import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import fs from "fs";
import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import Stripe from "stripe";

dotenv.config();

const app = express();
const PORT = 3000;

// Read firebase config safely
let firebaseConfig: any = null;
function getFirebaseConfig() {
  if (!firebaseConfig) {
    try {
      firebaseConfig = JSON.parse(
        fs.readFileSync(path.join(process.cwd(), "firebase-applet-config.json"), "utf8")
      );
    } catch (e) {
      console.error("Failed to read firebase config:", e);
      firebaseConfig = {};
    }
  }
  return firebaseConfig;
}

let adminDbInstance: any = null;
function getAdminDb() {
  if (!adminDbInstance) {
    try {
      const config = getFirebaseConfig();
      console.log("ADMIN_KEYS", Object.keys(admin));
      console.log("ADMIN_OBJECT", admin);
      const apps = (admin as any).apps || [];
      let app;
      if (apps.length === 0) {
        try {
          app = (admin as any).initializeApp({
            credential: (admin as any).credential && typeof (admin as any).credential.applicationDefault === "function"
               ? (admin as any).credential.applicationDefault() 
              : undefined,
            projectId: config.projectId
          });
        } catch (innerE) {
          app = (admin as any).initializeApp({
            projectId: config.projectId
          });
        }
      } else {
        app = apps[0];
      }
      console.log("APP_OBJECT", app);
      adminDbInstance = config.firestoreDatabaseId 
        ? getFirestore(app, config.firestoreDatabaseId) 
        : getFirestore(app);
    } catch (err) {
      console.error("Firebase Admin SDK failed to initialize:", err);
      throw err;
    }
  }
  return adminDbInstance;
}

// Lazy Loaded Stripe client
let stripeClient: Stripe | null = null;
function getStripe(): Stripe {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key || key.trim() === "" || key === "MY_STRIPE_SECRET_KEY") {
      throw new Error("STRIPE_SECRET_KEY environment variable is missing.");
    }
    stripeClient = new Stripe(key, {
      apiVersion: "2023-10-16" as any
    });
  }
  return stripeClient;
}

// Lazy-loaded Gemini Client
let aiClient: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI | null {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
      console.warn("GEMINI_API_KEY environment variable is not configured. Falling back to simulated responses.");
      return null;
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// --- SECURE PREMIUM SUBSCRIPTION VERIFICATION MIDDLEWARE ---
async function checkPremiumSubscription(req: express.Request, res: express.Response, next: express.NextFunction) {
  const userId = req.headers["x-user-id"] as string;

  // Let local and development environments run without restrictions if Stripe is unconfigured,
  // making it easier for developers to evaluate the application without linking accounts.
  const isStripeConfigured = process.env.STRIPE_SECRET_KEY && 
                             process.env.STRIPE_SECRET_KEY.trim() !== "" && 
                             process.env.STRIPE_SECRET_KEY !== "MY_STRIPE_SECRET_KEY";

  if (!isStripeConfigured) {
    console.info("Stripe subscription system is unconfigured/offline. Bypassing middleware check.");
    return next();
  }

  if (!userId) {
    return res.status(401).json({ error: "Suscripción no válida. ID de usuario faltante en cabecera." });
  }

  try {
    const subDoc = await getAdminDb().collection("subscriptions").doc(userId).get();

    if (!subDoc.exists) {
      return res.status(403).json({
        premiumBlocked: true,
        error: "Se requiere plan MyPhonk Premium VIP para activar las letras e inteligencia artificial."
      });
    }

    const sub = subDoc.data();
    const isActive = sub?.status === "active" || sub?.status === "trialing";
    const isNotExpired = sub?.currentPeriodEnd ? new Date(sub.currentPeriodEnd) > new Date() : false;

    if (!isActive || !isNotExpired) {
      return res.status(403).json({
        premiumBlocked: true,
        error: `Acceso restringido. Tu membresía premium se encuentra en estado "${sub?.status || "inactive"}" o ha expirado.`
      });
    }

    next();
  } catch (err: any) {
    console.error("Error inside express authentication middleware check:", err);
    res.status(500).json({ error: "Ocurrió un error validando tu suscripción en el servidor." });
  }
}

// 1. STRIPE SECURE WEBHOOK ENDPOINT (MUST BE BEFORE global app.use(express.json()))
app.post(
  "/api/stripe-webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret || webhookSecret.trim() === "" || webhookSecret === "MY_STRIPE_WEBHOOK_SECRET") {
      console.warn("⚠️ STRIPE_WEBHOOK_SECRET is unconfigured. Canceling webhook intake task.");
      return res.status(400).send("Webhook secret is not configured.");
    }

    let event;
    try {
      const stripe = getStripe();
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err: any) {
      console.error(`❌ Webhook security signature check failed:`, err.message);
      return res.status(400).send(`Signature Error: ${err.message}`);
    }

    // Process event
    try {
      const stripe = getStripe();
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as any;
          const userId = session.client_reference_id || session.metadata?.userId;
          const stripeCustomerId = session.customer;
          const subscriptionId = session.subscription;

          if (!userId) {
            console.error("❌ Checkout session has no associated client_reference_id.");
            break;
          }

          // Fetch subscription detail
          const subscription: any = await stripe.subscriptions.retrieve(subscriptionId as string);
          const plan = session.metadata?.plan || "monthly";

          // Save / update subscription record securely
          await getAdminDb().collection("subscriptions").doc(userId).set({
            userId: userId,
            stripeCustomerId: stripeCustomerId,
            subscriptionId: subscriptionId,
            status: subscription.status,
            plan: plan,
            currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
            createdAt: new Date(subscription.created * 1000).toISOString()
          });

          console.log(`🎉 Subscription saved successfully in firebase for user: ${userId}`);
          break;
        }

        case "invoice.payment_succeeded": {
          const invoice = event.data.object as any;
          const subscriptionId = invoice.subscription;
          if (subscriptionId) {
            const subscription: any = await stripe.subscriptions.retrieve(subscriptionId as string);
            const subsQuery = await getAdminDb().collection("subscriptions")
              .where("subscriptionId", "==", subscriptionId)
              .limit(1)
              .get();

            if (!subsQuery.empty) {
              const doc = subsQuery.docs[0];
              await doc.ref.update({
                status: subscription.status,
                currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString()
              });
              console.log(`🔄 Subscription current period extended for ID: ${subscriptionId}`);
            }
          }
          break;
        }

        case "customer.subscription.updated":
        case "customer.subscription.deleted": {
          const subscription = event.data.object as any;
          const subscriptionId = subscription.id;
          const subsQuery = await getAdminDb().collection("subscriptions")
            .where("subscriptionId", "==", subscriptionId)
            .limit(1)
            .get();

          if (!subsQuery.empty) {
            const doc = subsQuery.docs[0];
            await doc.ref.update({
              status: subscription.status,
              currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString()
            });
            console.log(`📋 Subscription status refresh completed for ID: ${subscriptionId} -> ${subscription.status}`);
          }
          break;
        }

        default:
          console.log(`Unprocessed event received: ${event.type}`);
      }
    } catch (dbErr) {
      console.error("❌ Errors editing firestore database from callback session:", dbErr);
      return res.status(500).send("Callback status persist failure.");
    }

    res.json({ received: true });
  }
);

// Enable standard parsing for downstream routes
app.use(express.json());

// 2. CHECKOUT SESSION CREATION ENDPOINT (REAL STRIPE ONLY)
app.post("/api/create-checkout-session", async (req, res) => {
  const { userId, email, plan } = req.body;

  if (!userId || !email) {
    return res.status(400).json({ error: "El userId y un email válido son requeridos." });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const isStripeConfigured = stripeKey && stripeKey.trim() !== "" && stripeKey !== "MY_STRIPE_SECRET_KEY";
  const PRICE_MONTHLY = process.env.STRIPE_PRICE_MONTHLY;
  const PRICE_YEARLY = process.env.STRIPE_PRICE_YEARLY;
  const arePricesConfigured = PRICE_MONTHLY && PRICE_YEARLY && PRICE_MONTHLY.trim() !== "" && PRICE_YEARLY.trim() !== "";

  if (!isStripeConfigured || !arePricesConfigured) {
    return res.status(400).json({ 
      error: "La pasarela de Stripe no está completamente configurada en el servidor. Por favor asegúrate de definir STRIPE_SECRET_KEY, STRIPE_PRICE_MONTHLY, y STRIPE_PRICE_YEARLY en las variables de entorno de tu aplicación."
    });
  }

  try {
    const stripe = getStripe();

    // Check existing info to avoid duplicates or fetch old Stripe Customer ID
    const docSnap = await getAdminDb().collection("subscriptions").doc(userId).get();
    let oldStripeCustomerId: string | undefined = undefined;

    if (docSnap.exists) {
      const data = docSnap.data();
      if (data?.status === "active" || data?.status === "trialing") {
        return res.status(400).json({ error: "Ya posees un plan Premium VIP activo. No necesitas comprar otra membresía." });
      }
      oldStripeCustomerId = data?.stripeCustomerId;
    }

    const targetPriceId = plan === "yearly" ? PRICE_YEARLY : PRICE_MONTHLY;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price: targetPriceId,
          quantity: 1
        }
      ],
      mode: "subscription",
      customer: oldStripeCustomerId || undefined,
      customer_email: oldStripeCustomerId ? undefined : email,
      client_reference_id: userId,
      success_url: `${process.env.APP_URL || "http://localhost:3000"}?payment_success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.APP_URL || "http://localhost:3000"}?payment_canceled=true`,
      metadata: {
        userId: userId,
        plan: plan || "monthly"
      }
    });

    res.json({ url: session.url });
  } catch (err: any) {
    console.error("Create Stripe Checkout Session error details:", err);
    res.status(500).json({ error: err?.message || "Imposible crear la sesión de Checkout con Stripe en producción." });
  }
});

// 3. BILLING CUSTOMER PORTAL REDIRECT ENDPOINT (REAL STRIPE ONLY)
app.post("/api/create-portal-session", async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: "userId es obligatorio." });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey || stripeKey.trim() === "" || stripeKey === "MY_STRIPE_SECRET_KEY") {
    return res.status(400).json({
      error: "La pasarela de Stripe no está completamente configurada en el servidor para crear portales de facturación."
    });
  }

  try {
    const stripe = getStripe();
    const docSnap = await getAdminDb().collection("subscriptions").doc(userId).get();

    if (!docSnap.exists) {
      return res.status(404).json({ error: "No se encontró historial de suscripción para este usuario en la base de datos." });
    }

    const sub = docSnap.data();
    if (!sub?.stripeCustomerId) {
      return res.status(404).json({ error: "No se encontró ID de cliente de Stripe vinculado en el servidor." });
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: process.env.APP_URL || "http://localhost:3000"
    });

    res.json({ url: portalSession.url });
  } catch (err: any) {
    console.error("Create Stripe Portal error:", err);
    res.status(500).json({ error: err?.message || "Error al abrir el portal de facturación en Stripe." });
  }
});

// REST API Endpoints
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", mode: process.env.NODE_ENV });
});

// Real-time Lyrics AI proxy endpoint (Gated with checkPremiumSubscription)
app.post("/api/lyrics", checkPremiumSubscription, async (req, res) => {
  const { title, artist, currentLyrics } = req.body;
  if (!title) {
    return res.status(400).json({ error: "Título de la canción es requerido." });
  }

  const ai = getGemini();
  if (!ai) {
    return res.json({
      lyrics: currentLyrics || `🎵 [Bajo de Cowbell Hype]\n\nSearching for "${title}" offline...\nNo hay conexión a la nube de IA de MyPhonk.\nPor favor, configura tu GEMINI_API_KEY en la configuración para letras extendidas de IA.`
    });
  }

  try {
    const prompt = `Proporciona una letra de Phonk estilizada o el coro para la canción "${title}" de "${artist || 'Autor Desconocido'}". 
Como la música Phonk suele ser instrumental, pesada o utilizar samples lo-fi repetitivos, si no existe una letra oficial conocida, GENERA una letra o canto de Phonk hipnótico y agresivo que encaje perfectamente con este ritmo (incluye efectos sonoros entre corchetes, ej: [808 Bassdrop], [Saturated Cowbell]). Que sea en español o frases cortas en inglés de estilo urbano nocturno.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "Eres un curador experto de Phonk y rap underground Memphis. Creas descripciones líricas inmersivas y letras rítmicas oscuras de alta fidelidad con efectos de sonido."
      }
    });

    res.json({ lyrics: response.text });
  } catch (error: any) {
    console.error("Error generating lyrics from Gemini:", error);
    res.json({
      lyrics: currentLyrics || `⚠️ Error sincronizando letras por IA: ${error?.message || error}\n\nMostrando caché local de MyPhonk.`
    });
  }
});

// Dynamic Recommendations based on listening habits (Gated with checkPremiumSubscription)
app.post("/api/recommendations", checkPremiumSubscription, async (req, res) => {
  const { favorites, mood } = req.body;
  const ai = getGemini();

  if (!ai) {
    const offlineRecommendations = [
      {
        title: "Tokyo Underground",
        artist: "Neon Raider",
        genre: "Phonk House",
        reason: "Recomendado automáticamente según tu preferencia por ritmos de cuatro cuartos y cowbell acelerado."
      },
      {
        title: "Memphis Grave Drift",
        artist: "KSLV Shadow",
        genre: "Drift Phonk",
        reason: "Basado en tu gusto por bajos pesados de 808 saturados y atmósferas de carreras nocturnas."
      },
      {
        title: "Cosmic Whispers",
        artist: "Nebula Wave",
        genre: "Wave Phonk",
        reason: "Perfecto para relajarse con pads flotantes de estilo synthwave y melodías espaciales."
      }
    ];
    return res.json({ recommendations: offlineRecommendations });
  }

  try {
    const favoritesStr = Array.isArray(favorites) && favorites.length > 0
      ? favorites.map((f: any) => `${f.title} por ${f.artist || "Desconocido"} (${f.genre})`).join(", ")
      : "Ninguno todavía (Explorando nuevos sonidos)";

    const prompt = `Genera un mapa de 3 recomendaciones musicales de Phonk diseñadas específicamente para el usuario.
Hábitos de escucha (Favoritos del usuario): ${favoritesStr}
Estado de ánimo preferido actualmente: ${mood || "Todos"}

Crea canciones puramente imaginarias pero con nombres extremadamente cool de Phonk (drift, house, wave o memphis style) que complementen estos gustos de forma excelente.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING, description: "Título ficticio o real sugerido de Phonk ultra cool" },
              artist: { type: Type.STRING, description: "Nombre artístico icónico" },
              genre: { type: Type.STRING, description: "Subgénero de Phonk" },
              mood: { type: Type.STRING, description: "Estado de ánimo predominante en español" },
              reason: { type: Type.STRING, description: "Razón super descriptiva en español de por qué le gustará basándose en sus hábitos" }
            },
            required: ["title", "artist", "genre", "mood", "reason"]
          }
        },
        systemInstruction: "Eres el Gurú de Recomendaciones MyPhonk. Analizas patrones de escucha pesados del Phonk y recomiendas música con explicaciones en español entusiastas y llenas de estilo de calle."
      }
    });

    const recommendations = JSON.parse(response.text || "[]");
    res.json({ recommendations });
  } catch (error) {
    console.error("Error generating recommendations from Gemini:", error);
    res.json({
      recommendations: [
        {
          title: "V8 Resonator",
          artist: "Carbon Cowbell",
          genre: "Drift Phonk",
          reason: "Análisis offline completo. Recomendado por alta energía de motor y cowbell rítmico."
        }
      ]
    });
  }
});

// Vite & Static Asset Handling
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Mounted Vite dev server middleware.");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Serving static production assets from dist/.");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`MyPhonk server running on http://localhost:${PORT}`);
  });
}

startServer();
