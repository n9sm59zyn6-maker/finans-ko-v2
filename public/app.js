/* =========================================================
   FİNANS KOÇU - APP.JS
   ========================================================= */

const SUPABASE_URL = "https://aludzquzksppncjncklhn.supabase.co";

const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFsdWR6cXV6a3BvbGNqbmtja2huIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0MDQxMjQsImV4cCI6MjEwNjk4MDEyNH0.6miEkb9_hxo17cRL6rpFaDUCP_BgEPzq1RkYPLPAwW0";

/*
  Eğer yukarıdaki anahtar Supabase tarafından değiştirilmişse
  Supabase > Project Settings > API kısmındaki ANON/PUBLISHABLE
  anahtarını buraya koy.
*/

const sb = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);


/* =========================================================
   SABİTLER
   ========================================================= */

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

const defaultBudgetLimits = {
  "Yemek & İçme": 5000,
  "Market": 4000,
  "Ulaşım": 3500,
  "Alışveriş": 4000,
  "Faturalar": 3000,
  "Eğlence": 2000,
  "Sağlık": 1500,
  "Diğer": 2000
};


/* =========================================================
   UYGULAMA DURUMU
   ========================================================= */

let data = {
  transactions: [],
  goal: 10000
};

let currentUser = null;


/* =========================================================
   YARDIMCI FONKSİYONLAR
   ========================================================= */

function money(value) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0
  }).format(Number(value) || 0);
}


function today() {
  return new Date().toISOString().slice(0, 10);
}


function esc(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    function (m) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      }[m];
    }
  );
}


function totals() {
  const income = data.transactions
    .filter(x => x.type === "income")
    .reduce((sum, x) => sum + Number(x.amount || 0), 0);

  const expense = data.transactions
    .filter(x => x.type === "expense")
    .reduce((sum, x) => sum + Number(x.amount || 0), 0);

  return {
    income,
    expense,
    saving: income - expense
  };
}


function getEl(id) {
  return document.getElementById(id);
}


/* =========================================================
   BAŞLANGIÇ
   ========================================================= */

async function init() {

  console.log("Finans Koçu başlatılıyor...");

  try {

    /*
      Navigasyon
    */

    document.querySelectorAll(".nav").forEach(button => {
      button.onclick = function () {
        switchView(button.dataset.view);
      };
    });


    /*
      Harcama kategorileri
    */

    const categorySelect = getEl("mCat");

    if (categorySelect) {
      categorySelect.innerHTML = cats
        .map(category => `<option value="${esc(category)}">${esc(category)}</option>`)
        .join("");
    }


    /*
      Tarih
    */

    const dateInput = getEl("mDate");

    if (dateInput) {
      dateInput.value = today();
    }


    /*
      Supabase mevcut oturum
    */

    const {
      data: sessionData,
      error
    } = await sb.auth.getSession();

    if (error) {
      console.error("Session error:", error);
      showAuth();
    } else if (sessionData?.session) {

      currentUser = sessionData.session.user;

      console.log("Mevcut kullanıcı:", currentUser.email);

      await loadData();
      showApp();

    } else {

      showAuth();

    }


    /*
      Auth değişikliklerini dinle
    */

    sb.auth.onAuthStateChange(async function (event, session) {

      console.log("Auth event:", event);

      if (session) {

        currentUser = session.user;

        await loadData();

        showApp();

      } else {

        currentUser = null;

        data.transactions = [];

        showAuth();

      }

    });

  } catch (error) {

    console.error("INIT ERROR:", error);

    notify(
      "Uygulama başlatılırken bir hata oluştu."
    );

  }
}


/* =========================================================
   AUTH
   ========================================================= */

function showAuth() {

  const modal = getEl("authModal");
  const main = document.querySelector("main");

  if (modal) {
    modal.classList.add("show");
  }

  if (main) {
    main.style.filter = "blur(4px)";
  }
}


function showApp() {

  const modal = getEl("authModal");
  const main = document.querySelector("main");

  if (modal) {
    modal.classList.remove("show");
  }

  if (main) {
    main.style.filter = "none";
  }

  renderAll();
}


/* =========================================================
   VERİLERİ SUPABASE'DEN AL
   ========================================================= */

async function loadData() {

  if (!currentUser) {
    return;
  }

  try {

    const transactionsResponse = await sb
      .from("transactions")
      .select(
        "id,user_id,type,description,amount,category,transaction_date,created_at"
      )
      .eq("user_id", currentUser.id)
      .order("transaction_date", {
        ascending: false
      });


    if (transactionsResponse.error) {

      console.error(
        "Transactions error:",
        transactionsResponse.error
      );

      notify(
        "Hareketler alınamadı: " +
        transactionsResponse.error.message
      );

      return;
    }


    const goalsResponse = await sb
      .from("goals")
      .select(
        "id,user_id,name,target_amount,current_amount,created_at"
      )
      .eq("user_id", currentUser.id)
      .order("created_at", {
        ascending: true
      })
      .limit(1);


    if (goalsResponse.error) {

      console.error(
        "Goals error:",
        goalsResponse.error
      );

    }


    const transactions =
      transactionsResponse.data || [];

    const goals =
      goalsResponse.data || [];


    data.transactions = transactions.map(x => ({
      id: x.id,
      type: x.type,
      desc: x.description,
      amount: Number(x.amount || 0),
      cat: x.category,
      date: x.transaction_date
    }));


    const goal = goals[0];


    if (goal) {

      data.goal = Number(
        goal.target_amount || 10000
      );

    } else {

      data.goal = 10000;

      const {
        error: goalInsertError
      } = await sb
        .from("goals")
        .insert({
          user_id: currentUser.id,
          name: "Aylık tasarruf hedefi",
          target_amount: 10000,
          current_amount: 0
        });

      if (goalInsertError) {

        console.error(
          "Goal create error:",
          goalInsertError
        );

      }

    }


    /*
      Avatar
    */

    const name =
      currentUser.user_metadata?.full_name ||
      currentUser.email?.split("@")[0] ||
      "Kullanıcı";


    const avatar = document.querySelector(".avatar");

    if (avatar) {
      avatar.textContent =
        name.slice(0, 1).toUpperCase();
    }


  } catch (error) {

    console.error("LOAD DATA ERROR:", error);

    notify(
      "Veriler yüklenirken bir hata oluştu."
    );

  }
}


/* =========================================================
   ANA RENDER
   ========================================================= */

function renderAll() {

  const t = totals();


  /*
    Dashboard değerleri
  */

  const available = getEl("available");
  const income = getEl("income");
  const expense = getEl("expense");
  const saving = getEl("saving");
  const savingRate = getEl("savingRate");
  const goal = getEl("goal");
  const goalRate = getEl("goalRate");

  if (available) {
    available.textContent = money(t.saving);
  }

  if (income) {
    income.textContent = money(t.income);
  }

  if (expense) {
    expense.textContent = money(t.expense);
  }

  if (saving) {
    saving.textContent = money(t.saving);
  }

  if (savingRate) {

    const rate =
      t.income > 0
        ? Math.round((t.saving / t.income) * 100)
        : 0;

    savingRate.textContent =
      rate + "% tasarruf";
  }

  if (goal) {
    goal.textContent = money(data.goal);
  }

  if (goalRate) {

    const rate =
      data.goal > 0
        ? Math.round(
            (t.saving / data.goal) * 100
          )
        : 0;

    goalRate.textContent =
      Math.min(100, Math.max(0, rate)) +
      "% tamamlandı";
  }


  /*
    Budget
  */

  const budgetIncome = getEl("budgetIncome");
  const budgetExpense = getEl("budgetExpense");
  const budgetLeft = getEl("budgetLeft");
  const budgetStatus = getEl("budgetStatus");

  if (budgetIncome) {
    budgetIncome.textContent = money(t.income);
  }

  if (budgetExpense) {
    budgetExpense.textContent = money(t.expense);
  }

  if (budgetLeft) {
    budgetLeft.textContent = money(t.saving);
  }

  if (budgetStatus) {

    budgetStatus.textContent =
      t.saving >= data.goal
        ? "🎯 Aylık hedefindesin."
        : "Hedefe yaklaşmak için harcamalarını azaltabilirsin.";

  }


  drawDonut();
  renderRecent();
  renderTransactions();
  renderBudget();
  renderInsight();
}


/* =========================================================
   DONUT GRAFİK
   ========================================================= */

function drawDonut() {

  const canvas = getEl("donut");

  if (!canvas) {
    return;
  }

  const ctx = canvas.getContext("2d");

  if (!ctx) {
    return;
  }

  const ratio =
    window.devicePixelRatio || 1;


  canvas.width = 190 * ratio;
  canvas.height = 190 * ratio;

  canvas.style.width = "190px";
  canvas.style.height = "190px";

  ctx.setTransform(
    ratio,
    0,
    0,
    ratio,
    0,
    0
  );


  let sums = {};


  data.transactions
    .filter(x => x.type === "expense")
    .forEach(x => {

      const category = x.cat || "Diğer";

      sums[category] =
        (sums[category] || 0) +
        Number(x.amount || 0);

    });


  const arr = Object.entries(sums)
    .sort((a, b) => b[1] - a[1]);


  const total = arr.reduce(
    (sum, item) => sum + item[1],
    0
  );


  let start = -Math.PI / 2;


  ctx.clearRect(
    0,
    0,
    190,
    190
  );


  /*
    Boş grafik
  */

  if (!total) {

    ctx.beginPath();

    ctx.lineWidth = 24;

    ctx.strokeStyle = "#eaecf0";

    ctx.arc(
      95,
      95,
      65,
      0,
      Math.PI * 2
    );

    ctx.stroke();

  } else {

    arr.forEach(
      ([category, value], index) => {

        const end =
          start +
          (value / total) *
            Math.PI *
            2;


        ctx.beginPath();

        ctx.lineWidth = 24;

        ctx.strokeStyle =
          colors[index % colors.length];

        ctx.arc(
          95,
          95,
          65,
          start,
          end - 0.03
        );

        ctx.stroke();

        start = end;

      }
    );

  }


  const center =
    getEl("donutCenter");

  if (center) {

    center.innerHTML = `
      <div>
        <span>${money(total)}</span>
        <small
          style="
            display:block;
            color:#667085;
            font-size:10px;
          "
        >
          Toplam gider
        </small>
      </div>
    `;

  }


  const legend =
    getEl("legend");


  if (legend) {

    legend.innerHTML =
      arr.length

        ? arr
            .map(
              ([category, value], index) => `
                <span class="legend-item">
                  <i
                    class="dot"
                    style="
                      background:
                        ${colors[index % colors.length]}
                    "
                  ></i>
                  ${esc(category)}
                  ${money(value)}
                </span>
              `
            )
            .join("")

        : `
          <span class="muted">
            Henüz gider yok.
          </span>
        `;
  }
}


/* =========================================================
   SON HAREKETLER
   ========================================================= */

function renderRecent() {

  const element = getEl("recent");

  if (!element) {
    return;
  }


  const transactions =
    [...data.transactions]
      .sort(
        (a, b) =>
          String(b.date).localeCompare(
            String(a.date)
          )
      )
      .slice(0, 5);


  element.innerHTML =
    transactions.length

      ? transactions
          .map(txHTML)
          .join("")

      : `
        <p class="muted">
          Henüz işlem bulunamadı.
        </p>
      `;
}


/* =========================================================
   TRANSACTION HTML
   ========================================================= */

function txHTML(x) {

  const icon =
    icons[
      x.type === "income"
        ? "Gelir"
        : x.cat
    ] || "📦";


  const sign =
    x.type === "income"
      ? "+"
      : "−";


  return `
    <div class="transaction">

      <div class="tx-left">

        <div class="tx-icon">
          ${icon}
        </div>

        <div>

          <div class="tx-title">
            ${esc(x.desc)}
          </div>

          <div class="tx-meta">
            ${
              x.type === "income"
                ? "Gelir"
                : esc(x.cat || "Diğer")
            }
            •
            ${esc(x.date)}
          </div>

        </div>

      </div>

      <div class="amount ${x.type}">
        ${sign}${money(x.amount)}
      </div>

    </div>
  `;
}


/* =========================================================
   TÜM HAREKETLER
   ========================================================= */

function renderTransactions() {

  const element =
    getEl("allTransactions");

  if (!element) {
    return;
  }


  const search =
    getEl("search")?.value
      ?.toLowerCase()
      .trim() || "";


  const filter =
    getEl("filter")?.value ||
    "all";


  const transactions =
    data.transactions
      .filter(x => {

        const matchesFilter =
          filter === "all" ||
          x.type === filter;


        const text =
          `${x.desc || ""} ${x.cat || ""}`
            .toLowerCase();


        const matchesSearch =
          text.includes(search);


        return (
          matchesFilter &&
          matchesSearch
        );

      })
      .sort(
        (a, b) =>
          String(b.date).localeCompare(
            String(a.date)
          )
      );


  element.innerHTML =
    transactions.length

      ? transactions
          .map(txHTML)
          .join("")

      : `
        <p class="muted">
          Henüz işlem bulunamadı.
        </p>
      `;
}


/* =========================================================
   BÜTÇE
   ========================================================= */

function renderBudget() {

  const element =
    getEl("budgetBars");

  if (!element) {
    return;
  }


  let sums = {};


  data.transactions
    .filter(x => x.type === "expense")
    .forEach(x => {

      const category =
        x.cat || "Diğer";

      sums[category] =
        (sums[category] || 0) +
        Number(x.amount || 0);

    });


  element.innerHTML =
    cats
      .map((category, index) => {

        const value =
          sums[category] || 0;

        const limit =
          defaultBudgetLimits[category] ||
          2000;

        const percentage =
          Math.min(
            100,
            (value / limit) * 100
          );


        return `
          <div class="budget-row">

            <div class="row-head">

              <span>
                ${icons[category]}
                ${esc(category)}
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
                  width:${percentage}%;
                "
              ></div>

            </div>

          </div>
        `;

      })
      .join("");
}


/* =========================================================
   AI / FİNANSAL İÇGÖRÜ
   ========================================================= */

function renderInsight() {

  const title =
    getEl("insightTitle");

  const text =
    getEl("insightText");


  if (!title || !text) {
    return;
  }


  const totalsData = totals();


  const expenses =
    data.transactions.filter(
      x => x.type === "expense"
    );


  let sums = {};


  expenses.forEach(x => {

    const category =
      x.cat || "Diğer";

    sums[category] =
      (sums[category] || 0) +
      Number(x.amount || 0);

  });


  const top =
    Object.entries(sums)
      .sort(
        (a, b) => b[1] - a[1]
      )[0];


  if (!top) {

    title.textContent =
      "Henüz yeterli veri yok.";

    text.textContent =
      "Birkaç işlem eklediğinde sana kişisel bir finansal analiz sunacağım.";

    return;
  }


  title.textContent =
    `${top[0]} en büyük harcama kalemin.`;


  const percentage =
    totalsData.income > 0
      ? Math.round(
          (top[1] /
            totalsData.income) *
            100
        )
      : 0;


  text.textContent =
    `${money(top[1])} harcadın. ` +
    `Gelirinin %${percentage}'i bu kategoriye gidiyor. ` +
    `Tasarruf hedefin ${money(data.goal)}.`;
}


/* =========================================================
   SAYFA DEĞİŞTİRME
   ========================================================= */

function switchView(view) {

  document
    .querySelectorAll(".view")
    .forEach(element => {
      element.classList.remove(
        "active-view"
      );
    });


  const selected =
    getEl(view);

  if (selected) {
    selected.classList.add(
      "active-view"
    );
  }


  document
    .querySelectorAll(".nav")
    .forEach(element => {

      element.classList.toggle(
        "active",
        element.dataset.view === view
      );

    });


  const names = {
    dashboard: "Genel Bakış",
    transactions: "Hareketler",
    budget: "Bütçe",
    ai: "AI Koç",
    receipt: "Fiş Tara"
  };


  const title =
    getEl("pageTitle");

  if (title) {

    title.textContent =
      names[view] ||
      "Genel Bakış";

  }


  if (window.innerWidth < 901) {

    document
      .querySelector(".sidebar")
      ?.classList.remove("open");

  }
}


/* =========================================================
   HARCAMA MODAL
   ========================================================= */

function openModal() {

  getEl("modal")
    ?.classList.add("show");

}


function closeModal() {

  getEl("modal")
    ?.classList.remove("show");

}


/* =========================================================
   GELİR MODAL
   ========================================================= */

function openIncomeModal() {

  getEl("incomeModal")
    ?.classList.add("show");

}


function closeIncomeModal() {

  getEl("incomeModal")
    ?.classList.remove("show");

}


/* =========================================================
   HARCAMA EKLE
   ========================================================= */

async function addExpense() {

  if (!currentUser) {

    notify(
      "Önce giriş yapmalısın."
    );

    showAuth();

    return;
  }


  const description =
    getEl("mDesc")
      ?.value
      ?.trim();


  const amount =
    Number(
      getEl("mAmount")?.value
    );


  const category =
    getEl("mCat")?.value;


  const date =
    getEl("mDate")?.value ||
    today();


  if (!description) {

    notify(
      "Harcama açıklaması gerekli."
    );

    return;
  }


  if (!amount || amount <= 0) {

    notify(
      "Geçerli bir tutar gir."
    );

    return;
  }


  try {

    const {
      data: row,
      error
    } = await sb
      .from("transactions")
      .insert({
        user_id: currentUser.id,
        type: "expense",
        description,
        amount,
        category,
        transaction_date: date
      })
      .select()
      .single();


    if (error) {

      console.error(
        "Expense error:",
        error
      );

      notify(
        "Kaydedilemedi: " +
        error.message
      );

      return;
    }


    data.transactions.unshift({

      id: row.id,

      type: "expense",

      desc: row.description,

      amount:
        Number(row.amount),

      cat:
        row.category,

      date:
        row.transaction_date

    });


    closeModal();


    if (getEl("mDesc")) {
      getEl("mDesc").value = "";
    }

    if (getEl("mAmount")) {
      getEl("mAmount").value = "";
    }


    renderAll();

    notify(
      "Harcama kaydedildi ✓"
    );


  } catch (error) {

    console.error(
      "ADD EXPENSE ERROR:",
      error
    );

    notify(
      "Harcama eklenirken hata oluştu."
    );

  }
}


/* =========================================================
   GELİR EKLE
   ========================================================= */

async function addIncome() {

  if (!currentUser) {

    notify(
      "Önce giriş yapmalısın."
    );

    showAuth();

    return;
  }


  const description =
    getEl("iDesc")
      ?.value
      ?.trim();


  const amount =
    Number(
      getEl("iAmount")?.value
    );


  if (!description) {

    notify(
      "Gelir açıklaması gerekli."
    );

    return;
  }


  if (!amount || amount <= 0) {

    notify(
      "Geçerli bir tutar gir."
    );

    return;
  }


  try {

    const {
      data: row,
      error
    } = await sb
      .from("transactions")
      .insert({
        user_id: currentUser.id,
        type: "income",
        description,
        amount,
        category: "Gelir",
        transaction_date: today()
      })
      .select()
      .single();


    if (error) {

      console.error(
        "Income error:",
        error
      );

      notify(
        "Kaydedilemedi: " +
        error.message
      );

      return;
    }


    data.transactions.unshift({

      id: row.id,

      type: "income",

      desc:
        row.description,

      amount:
        Number(row.amount),

      cat:
        "Gelir",

      date:
        row.transaction_date

    });


    closeIncomeModal();


    if (getEl("iDesc")) {
      getEl("iDesc").value = "";
    }

    if (getEl("iAmount")) {
      getEl("iAmount").value = "";
    }


    renderAll();

    notify(
      "Gelir kaydedildi ✓"
    );


  } catch (error) {

    console.error(
      "ADD INCOME ERROR:",
      error
    );

    notify(
      "Gelir eklenirken hata oluştu."
    );

  }
}


/* =========================================================
   AI KOÇ
   ========================================================= */

function askAI(question) {

  const input =
    getEl("aiInput");

  if (!input) {
    return;
  }


  input.value = question;

  sendAI();
}


async function sendAI() {

  if (!currentUser) {

    notify(
      "AI Koç için önce giriş yapmalısın."
    );

    return;
  }


  const input =
    getEl("aiInput");


  const box =
    getEl("chatMessages");


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

      throw new Error(
        "Oturum bulunamadı."
      );

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
      await response.json()
        .catch(() => ({}));


    getEl("aiTyping")
      ?.remove();


    if (!response.ok) {

      throw new Error(
        result.error ||
        "AI servisi hata verdi."
      );

    }


    box.innerHTML += `
      <div class="bubble bot">
        ${esc(
          result.answer ||
          "Yanıt alınamadı."
        )}
      </div>
    `;


    box.scrollTop =
      box.scrollHeight;


  } catch (error) {

    console.error(
      "AI ERROR:",
      error
    );


    getEl("aiTyping")
      ?.remove();


    box.innerHTML += `
      <div class="bubble bot">
        AI bağlantısında bir sorun oluştu.
        Biraz sonra tekrar dene.
      </div>
    `;


    box.scrollTop =
      box.scrollHeight;

  }
}


/* =========================================================
   FİŞ TARAMA
   ========================================================= */

function receiptSelected(element) {

  if (
    !element ||
    !element.files ||
    !element.files[0]
  ) {
    return;
  }


  const file =
    element.files[0];


  const result =
    getEl("receiptResult");


  if (result) {

    result.innerHTML = `
      <div
        style="
          margin-top:18px;
          padding:12px;
          background:#f5f3ff;
          border-radius:10px;
          font-size:12px;
          color:#5148e8;
        "
      >
        ✓ ${esc(file.name)}
        seçildi.
        OCR bağlantısı için hazır.
      </div>
    `;

  }


  notify(
    "Fiş görseli seçildi."
  );
}


/* =========================================================
   PRO
   ========================================================= */

function showPro() {

  notify(
    "Finans Koçu Pro çok yakında aktif."
  );

}


/* =========================================================
   TOAST
   ========================================================= */

function notify(message) {

  const toast =
    getEl("toast");


  if (!toast) {

    console.log(message);

    return;
  }


  toast.textContent =
    message;


  toast.classList.add(
    "show"
  );


  clearTimeout(
    notify.timer
  );


  notify.timer =
    setTimeout(
      function () {

        toast.classList.remove(
          "show"
        );

      },
      2500
    );
}


/* =========================================================
   MOBİL MENÜ
   ========================================================= */

function toggleSide() {

  document
    .querySelector(".sidebar")
    ?.classList.toggle(
      "open"
    );

}


/* =========================================================
   ÇIKIŞ
   ========================================================= */

async function signOut() {

  try {

    const {
      error
    } = await sb.auth.signOut();


    if (error) {

      console.error(
        "SIGN OUT ERROR:",
        error
      );

      notify(
        "Çıkış yapılamadı."
      );

      return;
    }


    currentUser = null;

    data.transactions = [];


    notify(
      "Çıkış yapıldı."
    );


  } catch (error) {

    console.error(
      error
    );

    notify(
      "Çıkış sırasında hata oluştu."
    );

  }
}


/* =========================================================
   GİRİŞ / KAYIT
   ========================================================= */

async function authSubmit() {

  const email =
    getEl("authEmail")
      ?.value
      ?.trim();


  const password =
    getEl("authPassword")
      ?.value || "";


  const name =
    getEl("authName")
      ?.value
      ?.trim() || "";


  const mode =
    getEl("authMode")
      ?.value || "login";


  if (!email) {

    notify(
      "E-posta adresini gir."
    );

    return;
  }


  if (!password) {

    notify(
      "Şifreni gir."
    );

    return;
  }


  if (password.length < 6) {

    notify(
      "Şifre en az 6 karakter olmalı."
    );

    return;
  }


  const button =
    getEl("authSubmit");


  if (button) {

    button.disabled = true;

    button.dataset.oldText =
      button.textContent;

    button.textContent =
      mode === "login"
        ? "Giriş yapılıyor..."
        : "Hesap oluşturuluyor...";

  }


  try {

    let result;


    /*
      GİRİŞ
    */

    if (mode === "login") {

      result =
        await sb.auth.signInWithPassword({
          email,
          password
        });

    }


    /*
      KAYIT
    */

    else {

      result =
        await sb.auth.signUp({

          email,

          password,

          options: {
            data: {
              full_name:
                name || email.split("@")[0]
            }
          }

        });

    }


    if (result.error) {

      console.error(
        "AUTH ERROR:",
        result.error
      );


      let message =
        result.error.message;


      /*
        Daha anlaşılır Türkçe mesajlar
      */

      if (
        message
          .toLowerCase()
          .includes("invalid login")
      ) {

        message =
          "E-posta veya şifre hatalı.";

      }


      if (
        message
          .toLowerCase()
          .includes("email not confirmed")
      ) {

        message =
          "E-posta adresini doğrulaman gerekiyor.";

      }


      if (
        message
          .toLowerCase()
          .includes("user already registered")
      ) {

        message =
          "Bu e-posta ile zaten hesap var. Giriş yapmayı dene.";

      }


      notify(message);

      return;
    }


    /*
      Kayıt başarılı
    */

    if (
      mode === "signup" &&
      !result.data?.session
    ) {

      notify(
        "Kayıt başarılı. E-postanı doğrulaman gerekiyorsa gelen kutunu kontrol et."
      );

      return;
    }


    /*
      Giriş başarılı
    */

    if (result.data?.session) {

      currentUser =
        result.data.session.user;


      await loadData();

      showApp();


      notify(
        "Giriş başarılı ✓"
      );

    }


  } catch (error) {

    console.error(
      "AUTH SUBMIT ERROR:",
      error
    );


    notify(
      "İşlem sırasında bir hata oluştu."
    );

  } finally {

    if (button) {

      button.disabled = false;

      button.textContent =
        button.dataset.oldText ||
        (
          mode === "login"
            ? "Giriş Yap"
            : "Kayıt Ol"
        );

    }

  }
}


/* =========================================================
   GİRİŞ / KAYIT MODU
   ========================================================= */

function toggleAuthMode() {

  const mode =
    getEl("authMode");


  if (!mode) {
    return;
  }


  const isLogin =
    mode.value === "login";


  mode.value =
    isLogin
      ? "signup"
      : "login";


  const title =
    getEl("authTitle");


  const nameWrap =
    getEl("authNameWrap");


  const submit =
    getEl("authSubmit");


  const toggle =
    getEl("authToggle");


  if (isLogin) {

    if (title) {
      title.textContent =
        "Hesap oluştur";
    }

    if (nameWrap) {
      nameWrap.style.display =
        "block";
    }

    if (submit) {
      submit.textContent =
        "Kayıt Ol";
    }

    if (toggle) {
      toggle.textContent =
        "Zaten hesabın var mı? Giriş yap";
    }

  } else {

    if (title) {
      title.textContent =
        "Finans Koçu'na giriş yap";
    }

    if (nameWrap) {
      nameWrap.style.display =
        "none";
    }

    if (submit) {
      submit.textContent =
        "Giriş Yap";
    }

    if (toggle) {
      toggle.textContent =
        "Hesabın yok mu? Kayıt ol";
    }

  }
}


/* =========================================================
   ARAMA / FİLTRE
   ========================================================= */

function setupSearch() {

  const search =
    getEl("search");

  const filter =
    getEl("filter");


  if (search) {

    search.addEventListener(
      "input",
      renderTransactions
    );

  }


  if (filter) {

    filter.addEventListener(
      "change",
      renderTransactions
    );

  }
}


/* =========================================================
   MODAL DIŞINA TIKLAYINCA KAPAT
   ========================================================= */

function setupModalClose() {

  document.addEventListener(
    "click",
    function (event) {

      if (
        event.target?.classList?.contains(
          "modal"
        )
      ) {

        event.target.classList.remove(
          "show"
        );

      }

    }
  );

}


/* =========================================================
   ESC TUŞU
   ========================================================= */

function setupKeyboard() {

  document.addEventListener(
    "keydown",
    function (event) {

      if (event.key !== "Escape") {
        return;
      }


      document
        .querySelectorAll(".modal.show")
        .forEach(modal => {
          modal.classList.remove(
            "show"
          );
        });

    }
  );

}


/* =========================================================
   WINDOW'A BAĞLA
   =========================================================

   Bu bölüm ÇOK ÖNEMLİ.

   HTML içerisinde onclick="authSubmit()"
   gibi kullanımlar varsa çalışmasını garanti eder.
*/

window.openModal = openModal;
window.closeModal = closeModal;

window.openIncomeModal =
  openIncomeModal;

window.closeIncomeModal =
  closeIncomeModal;

window.addExpense =
  addExpense;

window.addIncome =
  addIncome;

window.sendAI =
  sendAI;

window.askAI =
  askAI;

window.receiptSelected =
  receiptSelected;

window.showPro =
  showPro;

window.toggleSide =
  toggleSide;

window.signOut =
  signOut;

window.authSubmit =
  authSubmit;

window.toggleAuthMode =
  toggleAuthMode;

window.switchView =
  switchView;


/* =========================================================
   BAŞLAT
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  function () {

    setupSearch();

    setupModalClose();

    setupKeyboard();

    init();

  }
);
