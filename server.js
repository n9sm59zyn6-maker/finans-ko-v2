const express = require("express");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json({ limit: "2mb" }));

// Frontend dosyaları
app.use(express.static(path.join(__dirname, "public")));

// Geçici kullanıcı / oturum verileri
const sessions = new Map();
const users = new Map();
const transactions = new Map();

function hash(value) {
  return crypto
    .createHash("sha256")
    .update(value)
    .digest("hex");
}

function createToken() {
  return crypto.randomBytes(32).toString("hex");
}

// Authentication middleware
function auth(req, res, next) {
  const authorization = req.headers.authorization || "";
  const token = authorization.replace("Bearer ", "");

  const userId = sessions.get(token);

  if (!userId) {
    return res.status(401).json({
      error: "Oturum geçersiz."
    });
  }

  req.userId = userId;
  next();
}

// ================================
// REGISTER
// ================================

app.post("/api/auth/register", (req, res) => {
  const {
    email,
    password,
    name = ""
  } = req.body || {};

  const normalizedEmail = (email || "")
    .trim()
    .toLowerCase();

  if (!normalizedEmail || !password) {
    return res.status(400).json({
      error: "E-posta ve şifre gerekli."
    });
  }

  if (password.length < 6) {
    return res.status(400).json({
      error: "Şifre en az 6 karakter olmalı."
    });
  }

  if (users.has(normalizedEmail)) {
    return res.status(409).json({
      error: "Bu e-posta zaten kayıtlı."
    });
  }

  const userId = crypto.randomUUID();

  const user = {
    id: userId,
    email: normalizedEmail,
    name,
    password: hash(password)
  };

  users.set(normalizedEmail, user);
  transactions.set(userId, []);

  const sessionToken = createToken();

  sessions.set(sessionToken, userId);

  return res.json({
    token: sessionToken,
    user: {
      id: userId,
      email: normalizedEmail,
      name
    }
  });
});

// ================================
// LOGIN
// ================================

app.post("/api/auth/login", (req, res) => {
  const {
    email,
    password
  } = req.body || {};

  const normalizedEmail = (email || "")
    .trim()
    .toLowerCase();

  const user = users.get(normalizedEmail);

  if (!user) {
    return res.status(401).json({
      error: "E-posta veya şifre hatalı."
    });
  }

  if (user.password !== hash(password || "")) {
    return res.status(401).json({
      error: "E-posta veya şifre hatalı."
    });
  }

  const sessionToken = createToken();

  sessions.set(sessionToken, user.id);

  return res.json({
    token: sessionToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name
    }
  });
});

// ================================
// CURRENT USER
// ================================

app.get("/api/me", auth, (req, res) => {
  const user = [...users.values()].find(
    user => user.id === req.userId
  );

  if (!user) {
    return res.status(404).json({
      error: "Kullanıcı bulunamadı."
    });
  }

  return res.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name
    }
  });
});

// ================================
// TRANSACTIONS
// ================================

app.get("/api/transactions", auth, (req, res) => {
  const userTransactions =
    transactions.get(req.userId) || [];

  return res.json({
    transactions: userTransactions
  });
});

// ================================
// ADD TRANSACTION
// ================================

app.post("/api/transactions", auth, (req, res) => {
  const {
    desc,
    description,
    amount,
    cat = "Diğer",
    category,
    date,
    type = "expense"
  } = req.body || {};

  const finalDescription =
    desc || description;

  const finalCategory =
    category || cat;

  if (!finalDescription) {
    return res.status(400).json({
      error: "Açıklama gerekli."
    });
  }

  if (!Number(amount)) {
    return res.status(400).json({
      error: "Geçerli bir tutar gerekli."
    });
  }

  const transaction = {
    id: crypto.randomUUID(),
    desc: String(finalDescription),
    description: String(finalDescription),
    amount: Number(amount),
    cat: finalCategory,
    category: finalCategory,
    date:
      date ||
      new Date().toISOString().slice(0, 10),
    type
  };

  const userTransactions =
    transactions.get(req.userId) || [];

  userTransactions.push(transaction);

  transactions.set(
    req.userId,
    userTransactions
  );

  return res.json(transaction);
});

// ================================
// DELETE TRANSACTION
// ================================

app.delete(
  "/api/transactions/:id",
  auth,
  (req, res) => {
    const userTransactions =
      transactions.get(req.userId) || [];

    const filtered =
      userTransactions.filter(
        transaction =>
          transaction.id !== req.params.id
      );

    transactions.set(
      req.userId,
      filtered
    );

    return res.json({
      success: true
    });
  }
);

// ================================
// AI FINANS KOÇU
// ================================

app.post("/api/ai", auth, async (req, res) => {
  const apiKey =
    process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return res.json({
      answer:
        "AI bağlantısı henüz etkinleştirilmedi. OpenAI API anahtarı Render'a eklendiğinde gerçek Finans Koçu burada çalışacak."
    });
  }

  const userTransactions =
    transactions.get(req.userId) || [];

  const question =
    String(
      req.body?.question || ""
    );

  const prompt = `
Sen Türkçe konuşan kişisel finans koçusun.

Kullanıcının finansal hareketleri:

${JSON.stringify(
  userTransactions,
  null,
  2
)}

Kullanıcının sorusu:

${question}

Görevin:
- Harcamaları analiz et.
- Gereksiz harcamaları tespit etmeye yardımcı ol.
- Kullanıcıya kısa ve uygulanabilir öneriler ver.
- Gerektiğinde toplam harcama ve kategori dağılımını yorumla.
- Kesin yatırım getirisi veya garanti verme.
- Türkçe cevap ver.
- Gereksiz uzun cevap verme.
`;

  try {
    const response = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          "Authorization":
            `Bearer ${apiKey}`
        },

        body: JSON.stringify({
          model:
            process.env.OPENAI_MODEL ||
            "gpt-5.6-mini",

          input: prompt
        })
      }
    );

    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data?.error?.message ||
        "OpenAI API hatası."
      );
    }

    const answer =
      data.output_text ||
      "AI yanıt oluşturamadı.";

    return res.json({
      answer
    });

  } catch (error) {

    console.error(
      "AI ERROR:",
      error
    );

    return res.status(502).json({
      error:
        "AI servisine bağlanırken hata oluştu."
    });
  }
});

// ================================
// ANA SAYFA
// ================================

app.get("/", (req, res) => {
  res.sendFile(
    path.join(
      __dirname,
      "public",
      "index.html"
    )
  );
});

// ================================
// DİĞER SAYFALAR
// ================================

app.use((req, res, next) => {

  if (
    req.method === "GET" &&
    !req.path.startsWith("/api/")
  ) {

    return res.sendFile(
      path.join(
        __dirname,
        "public",
        "index.html"
      )
    );
  }

  next();
});

// ================================
// ERROR HANDLER
// ================================

app.use((err, req, res, next) => {

  console.error(err);

  res.status(500).json({
    error:
      "Sunucu tarafında bir hata oluştu."
  });
});

// ================================
// SERVER
// ================================

app.listen(PORT, "0.0.0.0", () => {

  console.log(
    `Finans Koçu running on port ${PORT}`
  );

});
