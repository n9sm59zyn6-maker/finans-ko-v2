const SUPABASE_URL = "https://aludzquzksppncjncklhn.supabase.co";

const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFsdWR6cXV6a3NwbmNqbmNrbGhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0MDQxMjQsImV4cCI6MjEwNjk4MDEyNH0.6miEkb9_hxo17cRL6rpFaDUCP_BgEPzq1RkYPLPAwW0";

const sb = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);


/* =========================
   AYARLAR
========================= */

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
  "#ec4a0c",
  "#98a2b3"
];

let data = {
  transactions: [],
  goal: 10000
};

let currentUser = null;
let authBusy = false;


/* =========================
   GENEL YARDIMCILAR
========================= */

function money(n) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0
  }).format(Number(n) || 0);
}


function setText(id, value) {
  const el = document.getElementById(id);

  if (el) {
    el.textContent = value;
  }
}


function esc(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[char])
  );
}


function notify(message) {
  const toast = document.getElementById("toast");

  if (!toast) {
    alert(message);
    return;
  }

  toast.textContent = message;
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}


/* =========================
   TOPLAMLAR
========================= */

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
   BAŞLAT
========================= */

async function init() {

  console.log("Finans Koçu başlatılıyor...");

  /* Kategoriler */

  const categorySelect =
    document.getElementById("mCat");

  if (categorySelect) {
    categorySelect.innerHTML = cats
      .map(category =>
        `<option value="${esc(category)}">${esc(category)}</option>`
      )
      .join("");
  }


  /* Tarih */

  const dateInput =
    document.getElementById("mDate");

  if (dateInput) {
    const today =
      new Date().toISOString().slice(0, 10);

    dateInput.value = today;
  }


  /* Menü */

  document
    .querySelectorAll(".nav")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {
          switchView(button.dataset.view);
        }
      );

    });


  /* Supabase session */

  try {

    const result =
      await sb.auth.getSession();

    console.log(
      "SESSION:",
      result
    );

    if (result.error) {

      console.error(
        "SESSION ERROR:",
        result.error
      );

      showAuth();
      return;
    }

    const session =
      result.data?.session;

    if (session?.user) {

      currentUser =
        session.user;

      console.log(
        "Kullanıcı bulundu:",
        currentUser.email
      );

      await loadData();

      showApp();

    } else {

      console.log(
        "Aktif kullanıcı yok."
      );

      showAuth();

    }

  } catch (error) {

    console.error(
      "INIT ERROR:",
      error
    );

    showAuth();
  }


  /* Auth değişikliklerini dinle */

  sb.auth.onAuthStateChange(
    async (event, session) => {

      console.log(
        "AUTH EVENT:",
        event
      );

      if (
        event === "INITIAL_SESSION"
      ) {
        return;
      }

      if (session?.user) {

        currentUser =
          session.user;

        try {
          await loadData();
        } catch (error) {
          console.error(
            "AUTH LOAD ERROR:",
            error
          );
        }

        showApp();

      } else {

        currentUser = null;

        showAuth();

      }

    }
  );

}


/* =========================
   VERİLERİ YÜKLE
========================= */

async function loadData() {

  if (!currentUser) {
    return;
  }

  console.log(
    "Veriler yükleniyor..."
  );


  try {

    const transactionsResponse =
      await sb
        .from("transactions")
        .select(
          "id,type,description,amount,category,transaction_date,created_at"
        )
        .eq(
          "user_id",
          currentUser.id
        )
        .order(
          "transaction_date",
          {
            ascending: false
          }
        );


    if (transactionsResponse.error) {

      console.error(
        "TRANSACTIONS ERROR:",
        transactionsResponse.error
      );

      /*
       * Tablo/RLS sorunu olsa bile
       * uygulamayı tamamen kilitlemiyoruz.
       */

      data.transactions = [];

    } else {

      data.transactions =
        (transactionsResponse.data || [])
          .map(row => ({
            id: row.id,
            type: row.type,
            desc: row.description,
            amount: Number(row.amount || 0),
            cat: row.category,
            date: row.transaction_date
          }));

    }


    /* Hedef */

    const goalsResponse =
      await sb
        .from("goals")
        .select(
          "id,target_amount,current_amount,created_at"
        )
        .eq(
          "user_id",
          currentUser.id
        )
        .order(
          "created_at",
          {
            ascending: true
          }
        )
        .limit(1);


    if (goalsResponse.error) {

      console.error(
        "GOALS ERROR:",
        goalsResponse.error
      );

      data.goal = 10000;

    } else {

      const goal =
        goalsResponse.data?.[0];

      if (goal) {

        data.goal =
          Number(
            goal.target_amount || 10000
          );

      } else {

        data.goal = 10000;

        const createGoal =
          await sb
            .from("goals")
            .insert({
              user_id: currentUser.id,
              name: "Aylık tasarruf hedefi",
              target_amount: 10000,
              current_amount: 0
            });

        if (createGoal.error) {

          console.error(
            "GOAL CREATE ERROR:",
            createGoal.error
          );

        }

      }

    }


    /* Avatar */

    const name =
      currentUser.user_metadata?.full_name ||
      currentUser.email?.split("@")[0] ||
      "Kullanıcı";

    const avatar =
      document.querySelector(".avatar");

    if (avatar) {
      avatar.textContent =
        name
          .charAt(0)
          .toUpperCase();
    }

    console.log(
      "Veriler başarıyla yüklendi."
    );

  } catch (error) {

    console.error(
      "LOAD DATA EXCEPTION:",
      error
    );

    data.transactions = [];
    data.goal = 10000;
  }

}


/* =========================
   DASHBOARD
========================= */

function renderAll() {

  const t = totals();

  setText(
    "available",
    money(t.saving)
  );

  setText(
    "income",
    money(t.income)
  );

  setText(
    "expense",
    money(t.expense)
  );

  setText(
    "saving",
    money(t.saving)
  );


  const savingRate =
    t.income > 0
      ? Math.round(
          (t.saving / t.income) * 100
        )
      : 0;

  setText(
    "savingRate",
    savingRate + "% tasarruf"
  );


  setText(
    "goal",
    money(data.goal)
  );


  const goalRate =
    data.goal > 0
      ? Math.round(
          (t.saving / data.goal) * 100
        )
      : 0;

  setText(
    "goalRate",
    Math.min(
      100,
      Math.max(0, goalRate)
    ) + "% tamamlandı"
  );


  setText(
    "budgetIncome",
    money(t.income)
  );

  setText(
    "budgetExpense",
    money(t.expense)
  );

  setText(
    "budgetLeft",
    money(t.saving)
  );


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


/* =========================
   DONUT
========================= */

function drawDonut() {

  const canvas =
    document.getElementById("donut");

  if (!canvas) {
    return;
  }

  const ctx =
    canvas.getContext("2d");

  const ratio =
    window.devicePixelRatio || 1;

  canvas.width =
    190 * ratio;

  canvas.height =
    190 * ratio;

  ctx.setTransform(
    ratio,
    0,
    0,
    ratio,
    0,
    0
  );

  ctx.clearRect(
    0,
    0,
    190,
    190
  );


  const sums = {};

  data.transactions
    .filter(
      x => x.type === "expense"
    )
    .forEach(x => {

      sums[x.cat] =
        (sums[x.cat] || 0) +
        Number(x.amount || 0);

    });


  const arr =
    Object.entries(sums)
      .sort(
        (a, b) => b[1] - a[1]
      );


  const total =
    arr.reduce(
      (sum, item) =>
        sum + item[1],
      0
    );


  let start =
    -Math.PI / 2;

  ctx.lineWidth = 24;


  if (total > 0) {

    arr.forEach(
      ([category, value], index) => {

        const end =
          start +
          (value / total) *
          Math.PI *
          2;

        ctx.strokeStyle =
          colors[
            index %
            colors.length
          ];

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
      }
    );

  }


  const center =
    document.getElementById(
      "donutCenter"
    );

  if (center) {

    center.innerHTML = `
      <div>
        <span>${money(total)}</span>
        <small style="
          display:block;
          color:#667085;
          font-size:10px;
        ">
          Toplam gider
        </small>
      </div>
    `;

  }


  const legend =
    document.getElementById(
      "legend"
    );

  if (legend) {

    legend.innerHTML =
      arr.length
        ? arr.map(
            ([category, value], index) => `
              <span class="legend-item">
                <i
                  class="dot"
                  style="
                    background:${
                      colors[
                        index %
                        colors.length
                      ]
                    }
                  "
                ></i>
                ${esc(category)}
                ${money(value)}
              </span>
            `
          ).join("")
        : "<span class='muted'>Henüz gider yok.</span>";

  }

}


/* =========================
   HAREKETLER
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


function renderRecent() {

  const element =
    document.getElementById(
      "recent"
    );

  if (!element) {
    return;
  }

  const transactions =
    [...data.transactions]
      .sort(
        (a, b) =>
          String(b.date)
            .localeCompare(
              String(a.date)
            )
      )
      .slice(0, 5);

  element.innerHTML =
    transactions.length
      ? transactions
          .map(txHTML)
          .join("")
      : "<p class='muted'>Henüz işlem bulunamadı.</p>";
}


function renderTransactions() {

  const element =
    document.getElementById(
      "allTransactions"
    );

  if (!element) {
    return;
  }


  const search =
    document.getElementById(
      "search"
    )?.value
      ?.toLowerCase() || "";


  const filter =
    document.getElementById(
      "filter"
    )?.value || "all";


  const transactions =
    data.transactions
      .filter(x => {

        const typeOK =
          filter === "all" ||
          x.type === filter;

        const searchOK =
          `${x.desc} ${x.cat}`
            .toLowerCase()
            .includes(search);

        return typeOK && searchOK;
      })
      .sort(
        (a, b) =>
          String(b.date)
            .localeCompare(
              String(a.date)
            )
      );


  element.innerHTML =
    transactions.length
      ? transactions
          .map(txHTML)
          .join("")
      : "<p class='muted'>Henüz işlem bulunamadı.</p>";

}


/* =========================
   BÜTÇE
========================= */

function renderBudget() {

  const element =
    document.getElementById(
      "budgetBars"
    );

  if (!element) {
    return;
  }


  const sums = {};

  data.transactions
    .filter(
      x => x.type === "expense"
    )
    .forEach(x => {

      sums[x.cat] =
        (sums[x.cat] || 0) +
        Number(x.amount || 0);

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
      .map(
        (category, index) => {

          const value =
            sums[category] || 0;

          const limit =
            limits[category] || 1000;

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
                  style="width:${percent}%"
                ></div>

              </div>

            </div>
          `;
        }
      )
      .join("");

}


/* =========================
   AI İÇGÖRÜ
========================= */

function renderInsight() {

  const title =
    document.getElementById(
      "insightTitle"
    );

  const text =
    document.getElementById(
      "insightText"
    );

  if (!title || !text) {
    return;
  }


  const t = totals();

  const sums = {};


  data.transactions
    .filter(
      x => x.type === "expense"
    )
    .forEach(x => {

      sums[x.cat] =
        (sums[x.cat] || 0) +
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
      "Birkaç işlem eklediğinde sana kişisel bir analiz sunacağım.";

    return;
  }


  title.textContent =
    `${top[0]} en büyük harcama kalemin.`;

  const percentage =
    t.income > 0
      ? Math.round(
          (top[1] / t.income) * 100
        )
      : 0;

  text.textContent =
    `${money(top[1])} harcadın. ` +
    `Gelirinin %${percentage}'i bu kategoriye gidiyor. ` +
    `Tasarruf hedefin ${money(data.goal)}.`;
}


/* =========================
   SAYFA DEĞİŞTİRME
========================= */

function switchView(view) {

  document
    .querySelectorAll(".view")
    .forEach(el =>
      el.classList.remove(
        "active-view"
      )
    );


  const target =
    document.getElementById(view);

  if (target) {
    target.classList.add(
      "active-view"
    );
  }


  document
    .querySelectorAll(".nav")
    .forEach(el =>
      el.classList.toggle(
        "active",
        el.dataset.view === view
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
      ?.classList.remove(
        "open"
      );

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
    return notify(
      "Önce giriş yapmalısın."
    );
  }


  const desc =
    document.getElementById(
      "mDesc"
    )?.value.trim();

  const amount =
    Number(
      document.getElementById(
        "mAmount"
      )?.value
    );

  const category =
    document.getElementById(
      "mCat"
    )?.value;

  const date =
    document.getElementById(
      "mDate"
    )?.value;


  if (!desc || !amount) {
    return notify(
      "Açıklama ve tutar gerekli."
    );
  }


  const result =
    await sb
      .from("transactions")
      .insert({
        user_id: currentUser.id,
        type: "expense",
        description: desc,
        amount: amount,
        category: category,
        transaction_date: date
      })
      .select()
      .single();


  if (result.error) {

    console.error(
      "EXPENSE ERROR:",
      result.error
    );

    return notify(
      "Kaydedilemedi: " +
      result.error.message
    );

  }


  data.transactions.unshift({
    id: result.data.id,
    type: "expense",
    desc: result.data.description,
    amount: Number(
      result.data.amount
    ),
    cat: result.data.category,
    date: result.data.transaction_date
  });


  closeModal();

  document.getElementById(
    "mDesc"
  ).value = "";

  document.getElementById(
    "mAmount"
  ).value = "";


  renderAll();

  notify(
    "Harcama kaydedildi ✓"
  );
}


/* =========================
   GELİR EKLE
========================= */

async function addIncome() {

  if (!currentUser) {
    return notify(
      "Önce giriş yapmalısın."
    );
  }


  const desc =
    document.getElementById(
      "iDesc"
    )?.value.trim();

  const amount =
    Number(
      document.getElementById(
        "iAmount"
      )?.value
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


  const result =
    await sb
      .from("transactions")
      .insert({
        user_id: currentUser.id,
        type: "income",
        description: desc,
        amount: amount,
        category: "Gelir",
        transaction_date: date
      })
      .select()
      .single();


  if (result.error) {

    console.error(
      "INCOME ERROR:",
      result.error
    );

    return notify(
      "Kaydedilemedi: " +
      result.error.message
    );
  }


  data.transactions.unshift({
    id: result.data.id,
    type: "income",
    desc: result.data.description,
    amount: Number(
      result.data.amount
    ),
    cat: "Gelir",
    date: result.data.transaction_date
  });


  closeIncomeModal();

  document.getElementById(
    "iDesc"
  ).value = "";

  document.getElementById(
    "iAmount"
  ).value = "";


  renderAll();

  notify(
    "Gelir kaydedildi ✓"
  );
}


/* =========================
   AUTH
========================= */

async function authSubmit() {

  if (authBusy) {
    return;
  }

  authBusy = true;


  const email =
    document.getElementById(
      "authEmail"
    )?.value.trim();

  const password =
    document.getElementById(
      "authPassword"
    )?.value || "";

  const name =
    document.getElementById(
      "authName"
    )?.value.trim() || "";

  const mode =
    document.getElementById(
      "authMode"
    )?.value || "login";


  const button =
    document.getElementById(
      "authSubmit"
    );


  const oldText =
    button?.textContent ||
    "Giriş Yap";


  try {

    if (!email) {
      throw new Error(
        "E-posta adresini gir."
      );
    }

    if (!password) {
      throw new Error(
        "Şifreni gir."
      );
    }

    if (password.length < 6) {
      throw new Error(
        "Şifre en az 6 karakter olmalı."
      );
    }


    if (button) {
      button.disabled = true;
      button.textContent =
        mode === "signup"
          ? "Hesap oluşturuluyor..."
          : "Giriş yapılıyor...";
    }


    /* =====================
       GİRİŞ
    ===================== */

    if (mode === "login") {

      const result =
        await sb.auth.signInWithPassword({
          email,
          password
        });


      if (result.error) {
        throw result.error;
      }


      if (!result.data?.user) {
        throw new Error(
          "Giriş yapıldı fakat kullanıcı alınamadı."
        );
      }


      currentUser =
        result.data.user;


      await loadData();

      showApp();

      notify(
        "Giriş başarılı ✓"
      );

      return;
    }


    /* =====================
       KAYIT
    ===================== */

    const signup =
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


    console.log(
      "SIGNUP RESULT:",
      signup
    );


    if (signup.error) {
      throw signup.error;
    }


    const user =
      signup.data?.user;

    let session =
      signup.data?.session;


    if (!user) {
      throw new Error(
        "Hesap oluşturulamadı."
      );
    }


    /*
     * E-posta doğrulaması kapalıysa
     * normalde session burada gelir.
     *
     * Gelmezse bir kez otomatik giriş
     * deniyoruz.
     */

    if (!session) {

      console.log(
        "Signup session yok, otomatik giriş deneniyor..."
      );


      const login =
        await sb.auth.signInWithPassword({
          email,
          password
        });


      if (login.error) {

        console.error(
          "AUTO LOGIN ERROR:",
          login.error
        );


        notify(
          "Hesap oluşturuldu. E-posta doğrulaması gerekiyorsa e-postanı onayla, ardından giriş yap."
        );

        return;
      }


      session =
        login.data?.session;

      currentUser =
        login.data?.user;

    } else {

      currentUser =
        user;

    }


    if (!session || !currentUser) {

      notify(
        "Hesap oluşturuldu. Şimdi giriş yapabilirsin."
      );

      return;
    }


    await loadData();

    showApp();

    notify(
      "Hesap oluşturuldu ✓"
    );


  } catch (error) {

    console.error(
      "AUTH ERROR:",
      error
    );


    notify(
      error?.message ||
      "Kimlik doğrulama sırasında hata oluştu."
    );


  } finally {

    authBusy = false;

    if (button) {

      button.disabled = false;

      button.textContent =
        oldText;

    }

  }

}


/* =========================
   AUTH MOD DEĞİŞTİR
========================= */

function toggleAuthMode() {

  const mode =
    document.getElementById(
      "authMode"
    );

  if (!mode) {
    return;
  }


  const signup =
    mode.value === "login";


  mode.value =
    signup
      ? "signup"
      : "login";


  setText(
    "authTitle",
    signup
      ? "Hesap oluştur"
      : "Finans Koçu'na giriş yap"
  );


  const nameWrap =
    document.getElementById(
      "authNameWrap"
    );

  if (nameWrap) {

    nameWrap.style.display =
      signup
        ? "block"
        : "none";

  }


  setText(
    "authSubmit",
    signup
      ? "Kayıt Ol"
      : "Giriş Yap"
  );


  setText(
    "authToggle",
    signup
      ? "Zaten hesabın var mı? Giriş yap"
      : "Hesabın yok mu? Kayıt ol"
  );

}


/* =========================
   AI
========================= */

function askAI(question) {

  const input =
    document.getElementById(
      "aiInput"
    );

  if (!input) {
    return;
  }

  input.value = question;

  sendAI();
}


async function sendAI() {

  const input =
    document.getElementById(
      "aiInput"
    );

  const box =
    document.getElementById(
      "chatMessages"
    );

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


  const typing =
    document.createElement("div");

  typing.id = "aiTyping";
  typing.className = "bubble bot";
  typing.textContent =
    "Analiz ediyorum…";

  box.appendChild(typing);


  try {

    const sessionResult =
      await sb.auth.getSession();

    const session =
      sessionResult.data?.session;


    if (!session) {

      typing.remove();

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


    typing.remove();


    box.innerHTML += `
      <div class="bubble bot">
        ${esc(
          result.answer ||
          result.error ||
          "Yanıt alınamadı."
        )}
      </div>
    `;


  } catch (error) {

    console.error(
      "AI ERROR:",
      error
    );

    typing.remove();

    box.innerHTML += `
      <div class="bubble bot">
        AI bağlantısında bir sorun oluştu.
      </div>
    `;

  }


  box.scrollTop =
    box.scrollHeight;
}


/* =========================
   FİŞ
========================= */

function receiptSelected(element) {

  const file =
    element.files?.[0];

  if (!file) {
    return;
  }


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
        color:#5148e8;
      ">
        ✓ ${esc(file.name)} seçildi.
        OCR bağlantısı için hazır.
      </div>
    `;

  }


  notify(
    "Fiş görseli seçildi."
  );
}


/* =========================
   PRO
========================= */

function showPro() {
  notify(
    "Pro ödeme ekranı sonraki entegrasyon adımında aktif edilecek."
  );
}


/* =========================
   MOBİL MENÜ
========================= */

function toggleSide() {

  document
    .querySelector(".sidebar")
    ?.classList.toggle(
      "open"
    );

}


/* =========================
   ÇIKIŞ
========================= */

async function signOut() {

  const result =
    await sb.auth.signOut();


  if (result.error) {

    console.error(
      "SIGNOUT ERROR:",
      result.error
    );

    return notify(
      "Çıkış yapılamadı."
    );

  }


  currentUser = null;

  showAuth();

  notify(
    "Çıkış yapıldı."
  );
}


/* =========================
   BAŞLAT
========================= */

init();
