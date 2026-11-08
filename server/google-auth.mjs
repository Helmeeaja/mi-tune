import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { createRemoteJWKSet, jwtVerify } from 'jose'

const derive=promisify(scrypt)
const keys=createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'),{timeoutDuration:10000,cooldownDuration:30000,cacheMaxAge:3600000})
function fail(message,code='GOOGLE_LOGIN_FAILED',status=400){return Object.assign(new Error(message),{code,status})}
function equal(a,b){const x=Buffer.from(a||'');const y=Buffer.from(b||'');return x.length===y.length&&timingSafeEqual(x,y)}
function nextPath(value){return typeof value==='string'&&value.startsWith('/')&&!value.startsWith('//')&&!value.startsWith('/api/')&&!/^\/(?:login|register)(?:[/?]|$)/.test(value)&&value.length<500?value:'/'}

export function createGoogleAuth({ db,clientId='',clientSecret='',appOrigin='http://127.0.0.1:5173' }) {
  const base=new URL(appOrigin)
  if(base.username||base.password||base.pathname!=='/'||base.search||base.hash||!(base.protocol==='https:'||(base.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(base.hostname))))throw fail('Alamat aplikasi untuk Google OAuth tidak valid.')
  const redirectUri=new URL('/api/auth/google/callback',base).href
  const enabled=Boolean(clientId&&clientSecret)
  const pending=new Map()
  function stateCookie(res,value,seconds){
    const current=res.getHeader('Set-Cookie')||[]
    res.setHeader('Set-Cookie',[...(Array.isArray(current)?current:[current]),`mt_google_state=${value}; Path=/api/auth/google; HttpOnly; SameSite=Lax; Max-Age=${seconds}${base.protocol==='https:'?'; Secure':''}`])
  }
  function begin(res,{next,owner=null,sessionHash=null}={}){
    if(!enabled)throw fail('Login Google belum dikonfigurasi. Gunakan username dan password dulu.','GOOGLE_NOT_CONFIGURED',503)
    for(const [id,item]of pending)if(Date.now()-item.createdAt>600000)pending.delete(id)
    if(pending.size>=500)throw fail('Login sedang sibuk. Coba sebentar lagi.','GOOGLE_BUSY',429)
    const state=randomBytes(32).toString('base64url')
    const nonce=randomBytes(32).toString('base64url')
    const verifier=randomBytes(48).toString('base64url')
    pending.set(state,{nonce,verifier,next:nextPath(next),owner,sessionHash,createdAt:Date.now()})
    stateCookie(res,state,600)
    const url=new URL('https://accounts.google.com/o/oauth2/v2/auth')
    url.search=new URLSearchParams({client_id:clientId,redirect_uri:redirectUri,response_type:'code',scope:'openid email profile',state,nonce,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256',prompt:'select_account'}).toString()
    res.writeHead(302,{Location:url.href});res.end()
  }
  async function complete(req,res,url){
    const state=url.searchParams.get('state')||''
    const cookie=/(?:^|;\s*)mt_google_state=([^;]+)/.exec(req.headers.cookie||'')?.[1]||''
    const flow=pending.get(state)
    pending.delete(state)
    stateCookie(res,'',0)
    if(!enabled||!flow||!equal(state,cookie)||Date.now()-flow.createdAt>600000||url.searchParams.has('error'))throw fail('Login Google dibatalkan atau kedaluwarsa. Coba lagi.')
    const code=url.searchParams.get('code')
    if(!code||code.length>4096)throw fail('Kode login Google belum terbaca.')
    const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code,client_id:clientId,client_secret:clientSecret,redirect_uri:redirectUri,grant_type:'authorization_code',code_verifier:flow.verifier}),signal:AbortSignal.timeout(15000)})
    if(!response.ok)throw fail('Login Google belum berhasil. Coba lagi.')
    const tokens=await response.json()
    if(typeof tokens.id_token!=='string'||tokens.id_token.length>16384)throw fail('Identitas Google belum terbaca.')
    const {payload}=await jwtVerify(tokens.id_token,keys,{issuer:['https://accounts.google.com','accounts.google.com'],audience:clientId,algorithms:['RS256'],requiredClaims:['sub','exp','iat','nonce','email','email_verified'],clockTolerance:5,maxTokenAge:'10m'})
    if(!equal(payload.nonce,flow.nonce)||payload.email_verified!==true||typeof payload.sub!=='string'||!payload.sub||payload.sub.length>255||typeof payload.email!=='string'||payload.email.length>254||!/^\S+@\S+\.\S+$/.test(payload.email)||(payload.azp&&payload.azp!==clientId))throw fail('Identitas Google belum bisa diverifikasi.')
    let user=db.prepare('SELECT * FROM users WHERE google_sub=?').get(payload.sub)
    if(flow.owner){
      const session=db.prepare('SELECT user_id FROM sessions WHERE token_hash=? AND expires_at>?').get(flow.sessionHash,Date.now())
      if(session?.user_id!==flow.owner||(user&&user.id!==flow.owner))throw fail('Akun Google ini belum bisa dihubungkan ke akunmu.')
      const updated=db.prepare('UPDATE users SET google_sub=? WHERE id=? AND (google_sub IS NULL OR google_sub=?)').run(payload.sub,flow.owner,payload.sub)
      if(!updated.changes)throw fail('Akun ini sudah terhubung dengan Google lain.')
      user=db.prepare('SELECT * FROM users WHERE id=?').get(flow.owner)
    }else if(!user){
      const prefix=payload.email.split('@')[0].replace(/[^A-Za-z0-9_]/g,'').slice(0,16)||'listener'
      let username=prefix.length>=3?prefix:`${prefix}_user`
      while(db.prepare('SELECT id FROM users WHERE username=? COLLATE NOCASE').get(username))username=`${prefix}_${randomBytes(3).toString('hex')}`
      const displayName=String(payload.name||username).replace(/[\u0000-\u001f]/g,'').trim().slice(0,60)||username
      const salt=randomBytes(16).toString('hex')
      const hash=(await derive(randomBytes(48).toString('base64url'),salt,64)).toString('hex')
      const id=randomUUID()
      db.prepare('INSERT INTO users(id,username,display_name,salt,password_hash,email,google_sub,joined_at,likes_visibility,google_only) VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,username,displayName,salt,hash,payload.email,payload.sub,Date.now(),'private',1)
      user=db.prepare('SELECT * FROM users WHERE id=?').get(id)
    }
    return {user,next:flow.owner?'/profile':flow.next}
  }
  return {enabled,redirectUri,startUrl:new URL('/api/auth/google',base).href,begin,complete}
}
