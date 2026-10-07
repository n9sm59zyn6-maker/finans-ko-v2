const express = require("express");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 10000;
app.use(express.json({limit:"2mb"}));
app.use(express.static(path.join(__dirname,"public")));

const sessions = new Map();
const users = new Map();
const transactions = new Map();

const hash = s => crypto.createHash("sha256").update(s).digest("hex");
const token = () => crypto.randomBytes(32).toString("hex");

function auth(req,res,next){
  const t=(req.headers.authorization||"").replace("Bearer ","");
  const uid=sessions.get(t);
  if(!uid) return res.status(401).json({error:"Oturum geçersiz."});
  req.userId=uid; next();
}

app.post("/api/auth/register",(req,res)=>{
  const {email,password,name=""}=req.body||{};
  const key=(email||"").trim().toLowerCase();
  if(!key || !password || password.length<6) return res.status(400).json({error:"Geçerli e-posta ve en az 6 karakterli şifre gerekli."});
  if(users.has(key)) return res.status(409).json({error:"Bu e-posta zaten kayıtlı."});
  const id=crypto.randomUUID();
  users.set(key,{id,email:key,name,password:hash(password)});
  transactions.set(id,[]);
  const t=token(); sessions.set(t,id);
  res.json({token:t,user:{id,email:key,name}});
});

app.post("/api/auth/login",(req,res)=>{
  const {email,password}=req.body||{};
  const key=(email||"").trim().toLowerCase(), u=users.get(key);
  if(!u || u.password!==hash(password||"")) return res.status(401).json({error:"E-posta veya şifre hatalı."});
  const t=token(); sessions.set(t,u.id);
  res.json({token:t,user:{id:u.id,email:u.email,name:u.name}});
});

app.get("/api/me",auth,(req,res)=>{
  const u=[...users.values()].find(x=>x.id===req.userId);
  res.json({user:{id:u.id,email:u.email,name:u.name}});
});

app.get("/api/transactions",auth,(req,res)=>res.json({transactions:transactions.get(req.userId)||[]}));

app.post("/api/transactions",auth,(req,res)=>{
  const {desc,amount,cat="Diğer",date,type="expense"}=req.body||{};
  if(!desc || !Number(amount)) return res.status(400).json({error:"Açıklama ve tutar gerekli."});
  const tx={id:crypto.randomUUID(),desc:String(desc),amount:Number(amount),cat,date:date||new Date().toISOString().slice(0,10),type};
  const list=transactions.get(req.userId)||[];
  list.push(tx); transactions.set(req.userId,list);
  res.json(tx);
});

app.delete("/api/transactions/:id",auth,(req,res)=>{
  transactions.set(req.userId,(transactions.get(req.userId)||[]).filter(x=>x.id!==req.params.id));
  res.json({ok:true});
});

app.post("/api/ai",async(req,res)=>{
  const key=process.env.OPENAI_API_KEY;
  if(!key) return res.json({answer:"AI bağlantısı henüz etkinleştirilmedi. Render'a OPENAI_API_KEY eklendiğinde gerçek Finans Koçu burada çalışacak."});
  const list=Array.isArray(req.body?.transactions)?req.body.transactions:[];
  const prompt=`Sen Türkçe konuşan kişisel finans koçusun. Kullanıcının işlemleri: ${JSON.stringify(list)}. Kullanıcı sorusu: ${String(req.body?.question||"")}. Kısa, net ve uygulanabilir cevap ver. Yatırım veya borç konularında kesin getiri/sonuç vaat etme.`;
  try{
    const r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${key}`},body:JSON.stringify({model:process.env.OPENAI_MODEL||"gpt-5.6-mini",input:prompt})});
    const j=await r.json(); if(!r.ok) throw new Error(j.error?.message||"AI hatası");
    res.json({answer:j.output_text||"Yanıt alınamadı."});
  }catch(e){res.status(502).json({error:e.message});}
});

app.listen(PORT,()=>console.log(`Finans Koçu running on ${PORT}`));
