const SUPABASE_URL = "https://aludzquzksppncjncklhn.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFsdWR6cXV6a3NwbmNqbmNrbGhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0MDQxMjQsImV4cCI6MjEwNjk4MDEyNH0.6miEkb9_hxo17cRL6rpFaDUCP_BgEPzq1RkYPLPAwW0";

const sb = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

const cats = [
  "Yemek & İçme",
  "Market",
  "Ulaşım",
  "Alışveriş",
  "Faturalar",
  "Eğlence",
  "Sağlık",
  "Diğer"
];

const icons = {
  "Yemek & İçme": "🍔",
  "Market": "🛒",
  "Ulaşım": "🚗",
  "Alışveriş": "🛍️",
  "Faturalar": "💡",
  "Eğlence": "🎮",
  "Sağlık": "💊",
  "Diğer": "📦",
  "Gelir": "💰"
};

const colors = [
  "#635bff",
  "#12b76a",
  "#f79009",
  "#f04438",
  "#7a5af8",
  "#06aed4",
  "#ec4a0a",
  "#98a2b3"
];

let data = {
  income: [],
  transactions: [],
  goal: 10000
};

let currentUser = null;


/* =========================
   GENEL
========================= */

function money(n) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0
  }).format(Number(n) || 0);
}


function totals() {
  const income = data.transactions
    .filter(x => x.type === "income")
    .reduce((a, x) => a + Number(x.amount), 0);

  const expense = data.transactions
    .filter(x => x.type === "expense")
    .reduce((a, x) => a + Number(x.amount), 0);

  return {
    income,
    expense,
    saving: income - expense
  };
}


function esc(s) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    m => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[m])
  );
}


/* =========================
   BAŞLAT
========================= */

async function init() {

  document.querySelectorAll(".nav").forEach(button => {
    button.onclick = () => switchView(button.dataset.view);
  });

  const categorySelect = document.getElementById("mCat");

  if (categorySelect) {
    categorySelect.innerHTML = cats
      .map(c => `<option>${c}</option>`)
      .join("");
  }

  const dateInput = document.getElementById("mDate");

  if (dateInput) {
    dateInput.value = new Date()
      .toISOString()
      .slice(0, 10);
  }

  try {

    const {
      data: sessionData,
      error
    } = await sb.auth.getSession();

    if (error) {
      console.error("SESSION ERROR:", error);
      showAuth();
      return;
    }

    const session = sessionData?.session;

    if (session?.user) {

      currentUser = session.user;

      await loadData();

      showApp();

    } else {

      showAuth();

    }

  } catch (error) {

    console.error("INIT ERROR:", error);

    showAuth();

  }


  sb.auth.onAuthStateChange(async (event, session) => {

    console.log("AUTH EVENT:", event);

    if (session?.user) {

      currentUser = session.user;

      try {
        await loadData();
      } catch (error) {
        console.error("LOAD DATA ERROR:", error);
      }

      showApp();

    } else {

      currentUser = null;

      showAuth();

    }

  });

}


/* =========================
   AUTH EKRANI
========================= */

function showAuth() {

  const modal = document.getElementById("authModal");
  const main = document.querySelector("main");

  if (modal) {
    modal.classList.add("show");
  }

  if (main) {
    main.style.filter = "blur(4px)";
  }
}


function showApp() {

  const modal = document.getElementById("authModal");
  const main = document.querySelector("main");

  if (modal) {
    modal.classList.remove("show");
  }

  if (main) {
    main.style.filter = "none";
  }

  renderAll();
}


/* =========================
   VERİLERİ YÜKLE
========================= */

async function loadData() {

  if (!currentUser) {
    return;
  }

  const [
    transactionsResult,
    goalsResult
  ] = await Promise.all([

    sb
      .from("transactions")
      .select(
        "id,type,description,amount,category,transaction_date,created_at"
      )
      .order("transaction_date", {
        ascending: false
      }),

    sb
      .from("goals")
      .select(
        "id,target_amount,current_amount,created_at"
      )
      .order("created_at", {
        ascending: true
      })
      .limit(1)

  ]);


  const tx = transactionsResult.data;
  const txError = transactionsResult.error;

  const goals = goalsResult.data;
  const goalError = goalsResult.error;


  if (txError) {

    console.error("TRANSACTIONS ERROR:", txError);

    data.transactions = [];

  } else {

    data.transactions = (tx || []).map(x => ({
      id: x.id,
      type: x.type,
      desc: x.description,
      amount: Number(x.amount),
      cat: x.category,
      date: x.transaction_date
    }));

  }


  if (goalError) {

    console.error("GOALS ERROR:", goalError);

    data.goal = 10000;

  } else {

    const goal = goals?.[0];

    data.goal = goal
      ? Number(goal.target_amount)
      : 10000;

    if (!goal) {

      const { error } = await sb
        .from("goals")
        .insert({
          user_id: currentUser.id,
          name: "Aylık tasarruf hedefi",
          target_amount: 10000,
          current_amount: 0
        });

      if (error) {
        console.error("GOAL CREATE ERROR:", error);
      }

    }

  }


  const name =
    currentUser.user_metadata?.full_name ||
    currentUser.email?.split("@")[0] ||
    "Kullanıcı";


  const avatar = document.querySelector(".avatar");

  if (avatar) {
    avatar.textContent = name
      .slice(0, 1)
      .toUpperCase();
  }

}


/* =========================
   DASHBOARD
========================= */

function renderAll() {

  const t = totals();


  setText("available", money(t.saving));
  setText("income", money(t.income));
  setText("expense", money(t.expense));
  setText("saving", money(t.saving));

  setText(
    "savingRate",
    (t.income
      ? Math.round((t.saving / t.income) * 100)
      : 0) + "% tasarruf"
  );

  setText("goal", money(data.goal));

  const goalRate = data.goal
    ? Math.round((t.saving / data.goal) * 100)
    : 0;

  setText(
    "goalRate",
    Math.min(100, Math.max(0, goalRate)) +
      "% tamamlandı"
  );

  setText("budgetIncome", money(t.income));
  setText("budgetExpense", money(t.expense));
  setText("budgetLeft", money(t.saving));

  setText(
    "budgetStatus",
    t.saving >= data.goal
      ? "🎯 Aylık hedefindesin."
      : "Hedefe yaklaşmak için harcamalarını azaltabilirsin."
  );


  drawDonut();
  renderRecent();
  renderTransactions();
  renderBudget();
  renderInsight();

}


function setText(id, value) {

  const el = document.getElementById(id);

  if (el) {
    el.textContent = value;
  }

}


/* =========================
   DONUT
========================= */

function drawDonut() {

  const canvas = document.getElementById("donut");

  if (!canvas) {
    return;
  }

  const ctx = canvas.getContext("2d");

  const d = window.devicePixelRatio || 1;

  canvas.width = 190 * d;
  canvas.height = 190 * d;

  ctx.setTransform(d, 0, 0, d, 0, 0);

  let sums = {};

  data.transactions
    .filter(x => x.type === "expense")
    .forEach(x => {
      sums[x.cat] =
        (sums[x.cat] || 0) +
        Number(x.amount);
    });


  const arr = Object.entries(sums)
    .sort((a, b) => b[1] - a[1]);


  const total = arr.reduce(
    (a, x) => a + x[1],
    0
  );


  let start = -Math.PI / 2;

  ctx.clearRect(0, 0, 190, 190);

  ctx.lineWidth = 24;


  if (total) {

    arr.forEach(([cat, value], i) => {

      const end =
        start +
        (value / total) *
          Math.PI *
          2;

      ctx.strokeStyle =
        colors[i % colors.length];

      ctx.beginPath();

      ctx.arc(
        95,
        95,
        65,
        start,
        end - 0.03
      );

      ctx.stroke();

      start = end;

    });

  }


  const center =
    document.getElementById("donutCenter");

  if (center) {

    center.innerHTML = `
      <div>
        <span>${money(total)}</span>
        <small style="
          display:block;
          color:#667085;
          font-size:10px
        ">
          Toplam gider
        </small>
      </div>
    `;

  }


  const legend =
    document.getElementById("legend");

  if (legend) {

    legend.innerHTML =
      arr.length
        ? arr
            .map(
              ([category, value], i) => `
                <span class="legend-item">
                  <i
                    class="dot"
                    style="
                      background:${
                        colors[i % colors.length]
                      }
                    "
                  ></i>
                  ${esc(category)}
                  ${money(value)}
                </span>
              `
            )
            .join("")
        : "<span class='muted'>Henüz gider yok.</span>";

  }

}


/* =========================
   SON HAREKETLER
========================= */

function renderRecent() {

  const element =
    document.getElementById("recent");

  if (!element) {
    return;
  }

  const transactions = [
    ...data.transactions
  ]
    .sort((a, b) =>
      String(b.date).localeCompare(
        String(a.date)
      )
    )
    .slice(0, 5);


  element.innerHTML =
    transactions.length
      ? transactions.map(txHTML).join("")
      : "<p class='muted'>Henüz işlem bulunamadı.</p>";

}


/* =========================
   TRANSACTION HTML
========================= */

function txHTML(x) {

  return `
    <div class="transaction">

      <div class="tx-left">

        <div class="tx-icon">
          ${
            icons[
              x.type === "income"
                ? "Gelir"
                : x.cat
            ] || "📦"
          }
        </div>

        <div>

          <div class="tx-title">
            ${esc(x.desc)}
          </div>

          <div class="tx-meta">
            ${
              x.type === "income"
                ? "Gelir"
                : esc(x.cat)
            }
            •
            ${esc(x.date)}
          </div>

        </div>

      </div>

      <div class="amount ${x.type}">
        ${x.type === "income" ? "+" : "−"}
        ${money(x.amount)}
      </div>

    </div>
  `;

}


/* =========================
   TÜM HAREKETLER
========================= */

function renderTransactions() {

  const element =
    document.getElementById("allTransactions");

  if (!element) {
    return;
  }


  const search =
    document.getElementById("search")?.value
      ?.toLowerCase() || "";

  const filter =
    document.getElementById("filter")?.value ||
    "all";


  const transactions =
    data.transactions
      .filter(x => {

        const matchesType =
          filter === "all" ||
          x.type === filter;

        const matchesSearch =
          `${x.desc} ${x.cat}`
            .toLowerCase()
            .includes(search);

        return matchesType && matchesSearch;

      })
      .sort((a, b) =>
        String(b.date).localeCompare(
          String(a.date)
        )
      );


  element.innerHTML =
    transactions.length
      ? transactions.map(txHTML).join("")
      : "<p class='muted'>Henüz işlem bulunamadı.</p>";

}


/* =========================
   BÜTÇE
========================= */

function renderBudget() {

  const element =
    document.getElementById("budgetBars");

  if (!element) {
    return;
  }


  let sums = {};

  data.transactions
    .filter(x => x.type === "expense")
    .forEach(x => {

      sums[x.cat] =
        (sums[x.cat] || 0) +
        Number(x.amount);

    });


  const limits = {
    "Yemek & İçme": 5000,
    "Market": 4000,
    "Ulaşım": 3500,
    "Alışveriş": 4000,
    "Faturalar": 3000,
    "Eğlence": 2000,
    "Sağlık": 1500,
    "Diğer": 2000
  };


  element.innerHTML =
    cats
      .map((category, i) => {

        const value =
          sums[category] || 0;

        const limit =
          limits[category];

        const percent =
          Math.min(
            100,
            (value / limit) * 100
          );


        return `
          <div class="budget-row">

            <div class="row-head">

              <span>
                ${icons[category]}
                ${category}
              </span>

              <span>
                ${money(value)}
                /
                ${money(limit)}
              </span>

            </div>

            <div class="bar">

              <div
                class="fill"
                style="
                  width:${percent}%
                "
              ></div>

            </div>

          </div>
        `;

      })
      .join("");

}


/* =========================
   AI INSIGHT
========================= */

function renderInsight() {

  const t = totals();

  const expenses =
    data.transactions.filter(
      x => x.type === "expense"
    );


  let sums = {};

  expenses.forEach(x => {

    sums[x.cat] =
      (sums[x.cat] || 0) +
      Number(x.amount);

  });


  const top =
    Object.entries(sums)
      .sort((a, b) => b[1] - a[1])[0];


  const title =
    document.getElementById("insightTitle");

  const text =
    document.getElementById("insightText");


  if (!title || !text) {
    return;
  }


  if (top) {

    title.textContent =
      `${top[0]} en büyük harcama kalemin.`;

    text.textContent =
      `${money(top[1])} harcadın. ` +
      `Gelirinin %${
        t.income
          ? Math.round(
              (top[1] / t.income) * 100
            )
          : 0
      }'i bu kategoriye gidiyor. ` +
      `Tasarruf hedefin ${money(data.goal)}.`;

  } else {

    title.textContent =
      "Henüz yeterli veri yok.";

    text.textContent =
      "Birkaç işlem eklediğinde sana kişisel bir analiz sunacağım.";

  }

}


/* =========================
   SAYFA DEĞİŞTİR
========================= */

function switchView(view) {

  document
    .querySelectorAll(".view")
    .forEach(x =>
      x.classList.remove("active-view")
    );


  const target =
    document.getElementById(view);

  if (target) {
    target.classList.add("active-view");
  }


  document
    .querySelectorAll(".nav")
    .forEach(x =>
      x.classList.toggle(
        "active",
        x.dataset.view === view
      )
    );


  const names = {
    dashboard: "Genel Bakış",
    transactions: "Hareketler",
    budget: "Bütçe",
    ai: "AI Koç",
    receipt: "Fiş Tara"
  };


  setText(
    "pageTitle",
    names[view] || "Finans Koçu"
  );


  if (window.innerWidth < 901) {

    document
      .querySelector(".sidebar")
      ?.classList.remove("open");

  }

}


/* =========================
   MODALLAR
========================= */

function openModal() {
  document
    .getElementById("modal")
    ?.classList.add("show");
}


function closeModal() {
  document
    .getElementById("modal")
    ?.classList.remove("show");
}


function openIncomeModal() {
  document
    .getElementById("incomeModal")
    ?.classList.add("show");
}


function closeIncomeModal() {
  document
    .getElementById("incomeModal")
    ?.classList.remove("show");
}


/* =========================
   HARCAMA EKLE
========================= */

async function addExpense() {

  if (!currentUser) {
    return notify("Önce giriş yapmalısın.");
  }


  const desc =
    document.getElementById("mDesc")
      ?.value
      ?.trim();

  const amount =
    Number(
      document.getElementById("mAmount")
        ?.value
    );

  const category =
    document.getElementById("mCat")
      ?.value;

  const date =
    document.getElementById("mDate")
      ?.value;


  if (!desc || !amount) {
    return notify(
      "Açıklama ve tutar gerekli."
    );
  }


  const {
    data: row,
    error
  } = await sb
    .from("transactions")
    .insert({
      user_id: currentUser.id,
      type: "expense",
      description: desc,
      amount,
      category,
      transaction_date: date
    })
    .select()
    .single();


  if (error) {

    console.error("EXPENSE ERROR:", error);

    return notify(
      "Kaydedilemedi: " +
      error.message
    );

  }


  data.transactions.unshift({
    id: row.id,
    type: row.type,
    desc: row.description,
    amount: Number(row.amount),
    cat: row.category,
    date: row.transaction_date
  });


  closeModal();

  document.getElementById("mDesc").value = "";
  document.getElementById("mAmount").value = "";

  renderAll();

  notify("Harcama kaydedildi ✓");

}


/* =========================
   GELİR EKLE
========================= */

async function addIncome() {

  if (!currentUser) {
    return notify("Önce giriş yapmalısın.");
  }


  const desc =
    document.getElementById("iDesc")
      ?.value
      ?.trim();

  const amount =
    Number(
      document.getElementById("iAmount")
        ?.value
    );


  if (!desc || !amount) {
    return notify(
      "Açıklama ve tutar gerekli."
    );
  }


  const date =
    new Date()
      .toISOString()
      .slice(0, 10);


  const {
    data: row,
    error
  } = await sb
    .from("transactions")
    .insert({
      user_id: currentUser.id,
      type: "income",
      description: desc,
      amount,
      category: "Gelir",
      transaction_date: date
    })
    .select()
    .single();


  if (error) {

    console.error("INCOME ERROR:", error);

    return notify(
      "Kaydedilemedi: " +
      error.message
    );

  }


  data.transactions.unshift({
    id: row.id,
    type: row.type,
    desc: row.description,
    amount: Number(row.amount),
    cat: "Gelir",
    date: row.transaction_date
  });


  closeIncomeModal();

  renderAll();

  notify("Gelir kaydedildi ✓");

}


/* =========================
   AI
========================= */

function askAI(question) {

  const input =
    document.getElementById("aiInput");

  if (!input) {
    return;
  }

  input.value = question;

  sendAI();

}


async function sendAI() {

  const input =
    document.getElementById("aiInput");

  const box =
    document.getElementById("chatMessages");


  if (!input || !box) {
    return;
  }


  const question =
    input.value.trim();


  if (!question) {
    return;
  }


  box.innerHTML += `
    <div class="bubble user">
      ${esc(question)}
    </div>
  `;


  input.value = "";


  box.innerHTML += `
    <div
      id="aiTyping"
      class="bubble bot"
    >
      Analiz ediyorum…
    </div>
  `;


  box.scrollTop =
    box.scrollHeight;


  try {

    const {
      data: sessionData
    } = await sb.auth.getSession();

    const session =
      sessionData?.session;


    if (!session) {

      document
        .getElementById("aiTyping")
        ?.remove();

      box.innerHTML += `
        <div class="bubble bot">
          AI kullanmak için giriş yapmalısın.
        </div>
      `;

      return;

    }


    const response =
      await fetch(
        "/api/ai",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            "Authorization":
              "Bearer " +
              session.access_token
          },

          body: JSON.stringify({
            question
          })
        }
      );


    const result =
      await response.json();


    document
      .getElementById("aiTyping")
      ?.remove();


    box.innerHTML += `
      <div class="bubble bot">
        ${esc(
          result.answer ||
          result.error ||
          "Yanıt alınamadı."
        )}
      </div>
    `;


    box.scrollTop =
      box.scrollHeight;


  } catch (error) {

    console.error("AI ERROR:", error);

    document
      .getElementById("aiTyping")
      ?.remove();


    box.innerHTML += `
      <div class="bubble bot">
        AI bağlantısında bir sorun oluştu.
      </div>
    `;

  }

}


/* =========================
   FİŞ
========================= */

function receiptSelected(element) {

  if (!element.files?.[0]) {
    return;
  }


  const file =
    element.files[0];


  const result =
    document.getElementById(
      "receiptResult"
    );


  if (result) {

    result.innerHTML = `
      <div style="
        margin-top:18px;
        padding:12px;
        background:#f5f3ff;
        border-radius:10px;
        font-size:12px;
        color:#5148e8
      ">
        ✓ ${esc(file.name)}
        seçildi.
        OCR bağlantısı için hazır.
      </div>
    `;

  }


  notify("Fiş görseli seçildi.");

}


/* =========================
   DİĞER
========================= */

function showPro() {
  notify(
    "Pro ödeme ekranı sonraki entegrasyon adımında aktif edilecek."
  );
}


function notify(message) {

  const toast =
    document.getElementById("toast");

  if (!toast) {
    return;
  }


  toast.textContent = message;

  toast.classList.add("show");


  setTimeout(() => {

    toast.classList.remove("show");

  }, 3000);

}


function toggleSide() {

  document
    .querySelector(".sidebar")
    ?.classList.toggle("open");

}


/* =========================
   ÇIKIŞ
========================= */

async function signOut() {

  const {
    error
  } = await sb.auth.signOut();


  if (error) {

    console.error(
      "SIGN OUT ERROR:",
      error
    );

    return notify(
      "Çıkış yapılamadı."
    );

  }


  notify("Çıkış yapıldı.");

}


/* =========================
   GİRİŞ / KAYIT
========================= */

async function authSubmit() {

  const email =
    document.getElementById(
      "authEmail"
    )?.value
      ?.trim();

  const password =
    document.getElementById(
      "authPassword"
    )?.value || "";

  const name =
    document.getElementById(
      "authName"
    )?.value
      ?.trim() || "";

  const mode =
    document.getElementById(
      "authMode"
    )?.value || "login";


  if (!email) {
    return notify(
      "E-posta adresini gir."
    );
  }


  if (!password) {
    return notify(
      "Şifreni gir."
    );
  }


  if (password.length < 6) {
    return notify(
      "Şifre en az 6 karakter olmalı."
    );
  }


  const button =
    document.getElementById(
      "authSubmit"
    );


  const originalText =
    button?.textContent ||
    "Giriş Yap";


  if (button) {

    button.disabled = true;

    button.textContent =
      mode === "login"
        ? "Giriş yapılıyor..."
        : "Hesap oluşturuluyor...";

  }


  try {

    let result;


    /* ===== GİRİŞ ===== */

    if (mode === "login") {

      result =
        await sb.auth.signInWithPassword({
          email,
          password
        });

    }


    /* ===== KAYIT ===== */

    else {

      result =
        await sb.auth.signUp({

          email,

          password,

          options: {
            data: {
              full_name:
                name ||
                email.split("@")[0]
            }
          }

        });

    }


    console.log(
      "SUPABASE AUTH RESULT:",
      result
    );


    /* ===== HATA ===== */

    if (result.error) {

      console.error(
        "SUPABASE AUTH ERROR:",
        result.error
      );


      notify(
        result.error.message ||
        "Kimlik doğrulama hatası."
      );


      return;

    }


    const user =
      result.data?.user;

    const session =
      result.data?.session;


    console.log(
      "SUPABASE USER:",
      user
    );

    console.log(
      "SUPABASE SESSION:",
      session
    );


    /* ===== BAŞARILI ===== */

    if (user && session) {

      currentUser = user;


      try {

        await loadData();

      } catch (error) {

        console.error(
          "LOAD DATA AFTER AUTH ERROR:",
          error
        );

      }


      showApp();

      notify(
        mode === "login"
          ? "Giriş başarılı ✓"
          : "Hesap oluşturuldu ✓"
      );


      return;

    }


    /* ===== KAYIT VAR SESSION YOK ===== */

    if (
      mode === "signup" &&
      user &&
      !session
    ) {

      notify(
        "Hesap oluşturuldu. Şimdi giriş yapabilirsin."
      );


      return;

    }


    /* ===== SESSION YOK ===== */

    notify(
      "İşlem tamamlandı fakat oturum oluşturulamadı."
    );


  } catch (error) {

    console.error(
      "AUTH EXCEPTION:",
      error
    );


    notify(
      "Hata: " +
      (error?.message ||
        "Bilinmeyen hata")
    );


  } finally {

    if (button) {

      button.disabled = false;

      button.textContent =
        originalText;

    }

  }

}


/* =========================
   GİRİŞ / KAYIT MODU
========================= */

function toggleAuthMode() {

  const mode =
    document.getElementById(
      "authMode"
    );

  if (!mode) {
    return;
  }


  const isLogin =
    mode.value === "login";


  mode.value =
    isLogin
      ? "signup"
      : "login";


  const newSignup =
    mode.value === "signup";


  setText(
    "authTitle",
    newSignup
      ? "Hesap oluştur"
      : "Finans Koçu'na giriş yap"
  );


  const nameWrap =
    document.getElementById(
      "authNameWrap"
    );


  if (nameWrap) {

    nameWrap.style.display =
      newSignup
        ? "block"
        : "none";

  }


  setText(
    "authSubmit",
    newSignup
      ? "Kayıt Ol"
      : "Giriş Yap"
  );


  setText(
    "authToggle",
    newSignup
      ? "Zaten hesabın var mı? Giriş yap"
      : "Hesabın yok mu? Kayıt ol"
  );

}


/* =========================
   BAŞLAT
========================= */

init();
