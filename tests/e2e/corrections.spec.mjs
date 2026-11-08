import { test, expect } from '@playwright/test'
import { mkdtemp, rm, mkdir, stat, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { createReadStream } from 'node:fs'
import { createApplication } from '../../server/app.mjs'
import { resolveRange } from '../../server/range.mjs'

const artistId = 'UC' + 'a'.repeat(22)
const creatorId = 'UC' + 'p'.repeat(22)
const albumId = 'MPREb_explicit_corrections_fixture'
const showId = 'MPSPPL' + 'p'.repeat(22)
const songs = Array.from({ length: 4 }, (_, index) => ({ id: `yt:${String(index).padStart(11,'0')}`, title: `Explicit song fixture ${index + 1}`, artist: 'Explicit artist fixture', artists: ['Explicit artist fixture'], artistRefs: [{ id: artistId, name: 'Explicit artist fixture' }], type: 'song', source: 'youtube-music', musicType: 'MUSIC_VIDEO_TYPE_ATV', duration: 120, albumId, album: 'Explicit album fixture', thumbnail: '', coverUrl: '', chartRank: index + 1, spotifyId: String(index).padStart(22,'0'), spotifyUri: `spotify:track:${String(index).padStart(22,'0')}`, rankingSource: 'spotify' }))
const episodes = Array.from({ length: 3 }, (_, index) => ({ id: `podcast:yt:${String(index + 100).padStart(11,'0')}`, title: `Explicit episode fixture ${index + 1}`, artist: 'Explicit creator fixture', artists: ['Explicit creator fixture'], type: 'episode', contentKind: 'podcast', musicType: 'MUSIC_VIDEO_TYPE_PODCAST_EPISODE', source: 'youtube-music-podcast', creatorId, showId, duration: 120, thumbnail: '', coverUrl: '', publishedAt: '2026-11-05T00:00:00Z', description: 'Explicit source description for UI testing, not live podcast content.' }))
const show = { id: showId, title: 'Explicit podcast fixture', creatorId, episodes }
const creator = { id: creatorId, name: 'Explicit creator fixture', source: 'youtube-music-podcast', thumbnail: '', active: true, episodes, shows: [show], description: 'Explicit creator biography fixture.' }
const podcastFeed = { creators: [creator], shows: [show], episodes, creatorCount: 1, showCount: 1, episodeCount: 3, updatedAt: 1794111292217, source: 'Explicit UI fixture, not a live provider', stale: false }
const chart = { tracks: songs, region: 'ZZ', chartVersion: 3, chartOrigin: 'spotify', chartProvider: 'spotify', chartId: '37i9dQZEVXbMDoHDwVN2tF', sourceUrl: 'https://open.spotify.com/playlist/37i9dQZEVXbMDoHDwVN2tF', sourceTotal: 4, updatedAt: 1794111292217, dateKind: 'retrieved', source: 'Explicit Spotify reference fixture, not a live chart', stale: false }
const artist = { id: artistId, name: songs[0].artist, thumbnail: '', description: 'Explicit artist biography fixture.', tracks: songs, albums: [], singles: [], related: [], source: 'youtube-music' }
const album = { id: albumId, title: songs[0].album, artists: [{ id: artistId, name: songs[0].artist }], tracks: songs, tracklist: songs.map((song,index) => ({ ...song, position: index + 1, playable: true })), sourceTotal: 4, thumbnail: '', source: 'youtube-music' }
const user = { id: '00000000-0000-4000-8000-000000000001', username: 'explicit_fixture', displayName: 'Explicit UI fixture user', bio: 'Synthetic UI fixture only', email: '', avatar: null, joinedAt: 1794111292217 }
const library = { tracks: songs, favoriteIds: [songs[0].id], playlists: [{ id: '00000000-0000-4000-8000-000000000002', name: 'Explicit fixture playlist', trackIds: songs.map(song => song.id), cover: null }] }
let app
let directory
let base
let evidence

function media(req,res,path,size) {
  let range
  try { range = resolveRange(req.headers.range,size) } catch { res.writeHead(416,{'Content-Range':`bytes */${size}`}); res.end(); return }
  const headers = { 'Content-Type':'audio/mpeg', 'Accept-Ranges':'bytes', 'Content-Length': range ? range.end - range.start + 1 : size }
  if (range) headers['Content-Range'] = `bytes ${range.start}-${range.end}/${size}`
  res.writeHead(range ? 206 : 200,headers)
  if (req.method === 'HEAD') { res.end(); return }
  const stream = createReadStream(path,range || {})
  stream.pipe(res)
  res.on('close',()=>stream.destroy())
}

test.beforeAll(async () => {
  if (!process.env.TMPDIR) throw new Error('Scratch directory required')
  directory = await mkdtemp(join(process.env.TMPDIR,'mi-tune-corrections-fixture-'))
  evidence = join(process.env.TMPDIR,'mi-tune-corrections-qa')
  await mkdir(evidence,{recursive:true})
  const audio = join(directory,'explicit-ui-fixture-tone.mp3')
  execFileSync('ffmpeg',['-nostdin','-hide_banner','-loglevel','error','-f','lavfi','-i','sine=frequency=330:duration=120','-threads','1','-codec:a','libmp3lame','-b:a','64k',audio],{timeout:45000})
  const size = (await stat(audio)).size
  const music = { search: async()=>songs, trending:async()=>chart, lookup:id=>songs.find(song=>song.id===id), audio:id=>songs.some(song=>song.id===id)?{path:audio,size,mime:'audio/mpeg'}:null, close(){} }
  const podcasts = { discover:async()=>podcastFeed, search:async()=>podcastFeed, creator:async()=>creator, episode:async id=>episodes.find(item=>item.id===id), stream:async(req,res)=>media(req,res,audio,size), close(){} }
  const catalogue = { search:async()=>({artists:[artist],albums:[album]}), artist:async()=>artist, album:async()=>album, close(){} }
  app = await createApplication({ dataDir:directory, distDir:process.env.MI_TUNE_TEST_DIST || resolve('dist'), musicService:music, artistCatalog:catalogue, podcastService:podcasts, lyricsFetcher:async()=>({matched:true,plainLyrics:'Explicit fixture lyrics',source:'Explicit test fixture'}),refreshIntervalMs:3600000 })
  await new Promise(done=>app.server.listen(0,'127.0.0.1',done))
  base=`http://127.0.0.1:${app.server.address().port}`
})

test.afterAll(async()=>{await app?.close();if(directory)await rm(directory,{recursive:true,force:true})})

async function setup(page, language='en', custom=false) {
  await page.addInitScript(({language,custom})=>{
    if (!localStorage.getItem('mi-tune-settings')) localStorage.setItem('mi-tune-settings',JSON.stringify({language,animations:false,smoothScroll:false,autoplayNext:false,preloadNext:false,theme:'dark',...(custom?{textColor:'#ffffff',iconColor:'#ff6600',backgroundColor:'#141414'}:{})}))
  },{language,custom})
  const data=(path,value)=>page.route(`**/api/${path}`,route=>route.fulfill({json:{data:value}}))
  await data('auth/me',{user})
  await data('library',library)
  await data('friends',{friends:[],incoming:[],outgoing:[]})
  await data('followed-artists',{artists:[]})
  await data('profile',{user})
}

async function colors(page, text='rgb(255, 255, 255)', icon='rgb(255, 102, 0)') {
  return page.evaluate(({text,icon})=>{
    const visible=element=>element.getClientRects().length&&getComputedStyle(element).visibility!=='hidden'
    const textNodes=[...document.querySelectorAll('body *')].filter(element=>visible(element)&&!element.closest('svg,script,style')&&[...element.childNodes].some(node=>node.nodeType===Node.TEXT_NODE&&node.textContent.trim()))
    const icons=[...document.querySelectorAll('svg.lucide,.music-equalizer i')].filter(visible)
    return {textCount:textNodes.length,iconCount:icons.length,badText:textNodes.filter(element=>getComputedStyle(element).color!==text).map(element=>({text:element.textContent.slice(0,60),color:getComputedStyle(element).color})),badIcons:icons.filter(element=>getComputedStyle(element).color!==icon).map(element=>({class:element.getAttribute('class'),color:getComputedStyle(element).color}))}
  },{text,icon})
}

for (const language of ['id','en']) test(`global foreground and icons cover every route in ${language}`,async({page})=>{
  test.setTimeout(180000)
  await setup(page,language,true)
  const errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  const routes=['/','/search',`/artist/${artistId}`,`/album/${albumId}`,`/track/${encodeURIComponent(songs[0].id)}`,'/podcasts',`/podcasts/creator/${creatorId}`,`/podcasts/episode/${encodeURIComponent(episodes[0].id)}`,'/library','/downloads','/friends','/settings','/profile','/trending','/login','/register']
  const collected=[]
  for (const route of routes) {
    await page.goto(base+route,{waitUntil:'domcontentloaded'})
    await expect(page.locator('main')).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('data-custom-text','true')
    await expect.poll(async()=>{const result=await colors(page);return result.badText.length+result.badIcons.length}).toBe(0)
    collected.push({route,...await colors(page)})
  }
  expect(collected.length).toBe(routes.length)
  expect(collected.every(result=>result.textCount>0&&result.iconCount>0)).toBe(true)
  expect(errors).toEqual([])
  await writeFile(join(evidence,`global-colors-${language}.json`),JSON.stringify(collected,null,2))
})

test('podcast discovery, creator episodes and actual browser audio clock work without touching the music endpoint',async({page})=>{
  test.setTimeout(90000)
  await setup(page)
  const streamUrls=[]
  page.on('request',request=>{if(request.url().includes('/stream'))streamUrls.push(request.url())})
  await page.goto(base+'/podcasts')
  await expect(page.locator('[data-podcast-creator]')).toHaveCount(1)
  await page.locator('[data-podcast-creator]').click()
  await expect(page.locator('[data-page="podcast-creator"] [data-podcast-episode]')).toHaveCount(3)
  await page.getByRole('button',{name:'Play episode '+episodes[0].title,exact:true}).first().click()
  const audio=page.locator('audio:not([aria-hidden="true"])')
  await expect(audio).toHaveAttribute('data-track',episodes[0].id)
  await expect.poll(()=>audio.evaluate(element=>!element.paused&&element.currentTime>.3),{timeout:15000}).toBe(true)
  const before=await audio.evaluate(element=>({time:element.currentTime,src:element.currentSrc}))
  await page.locator('#music-search').fill('Explicit')
  await page.locator('#music-search').press('Enter')
  await expect(page.locator('[data-search-results] [data-track-id]').first()).toBeVisible()
  await expect(page).toHaveURL(base+'/podcasts/episode/'+encodeURIComponent(episodes[0].id))
  const after=await audio.evaluate(element=>({time:element.currentTime,src:element.currentSrc}))
  expect(after.src).toBe(before.src)
  expect(after.time).toBeGreaterThan(before.time)
  expect(streamUrls.some(url=>url.includes('/api/podcasts/episodes/'))).toBe(true)
  expect(streamUrls.some(url=>url.includes('/api/tracks/podcast'))).toBe(false)
})

test('six mobile navigation targets and populated podcast controls fit 320 through 1440 pixels',async({page})=>{
  test.setTimeout(120000)
  await setup(page)
  await page.goto(base+'/podcasts')
  const collected=[]
  for(const width of [320,360,390,768,1024,1440]) {
    await page.setViewportSize({width,height:900})
    await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))))
    const result=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,clipped:[...document.querySelectorAll('button,a[href],input,select')].filter(element=>{const r=element.getBoundingClientRect();return r.width>4&&r.height>4&&r.top<innerHeight&&r.bottom>0&&getComputedStyle(element).visibility!=='hidden'&&!element.classList.contains('sr-only')&&(r.left< -1||r.right>innerWidth+1)}).map(element=>element.getAttribute('aria-label')||element.textContent.trim().slice(0,60))}))
    expect(result.scroll).toBeLessThanOrEqual(width+1)
    expect(result.clipped).toEqual([])
    if(width<1024) await expect(page.getByRole('navigation',{name:'Mobile navigation'}).getByRole('link')).toHaveCount(6)
    collected.push(result)
  }
  await writeFile(join(evidence,'podcast-responsive.json'),JSON.stringify(collected,null,2))
})

test('changing color inputs updates every foreground immediately, persists, and can return to the theme',async({page})=>{
  await setup(page)
  await page.goto(base+'/settings')
  const change=async(label,value)=>page.getByLabel(label,{exact:true}).evaluate((input,value)=>{
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value)
    input.dispatchEvent(new Event('input',{bubbles:true}))
    input.dispatchEvent(new Event('change',{bubbles:true}))
  },value)
  await change('Text color','#ffffff')
  await change('Icon color','#ff6600')
  await expect(page.locator('html')).toHaveAttribute('data-custom-text','true')
  await expect.poll(async()=>{const result=await colors(page);return result.badText.length+result.badIcons.length}).toBe(0)
  const settings=await colors(page)
  await page.locator('aside a[href="/"]').first().click()
  await page.getByRole('button',{name:'Play '+songs[0].title,exact:true}).first().click()
  await expect.poll(()=>page.locator('audio:not([aria-hidden="true"])').evaluate(audio=>!audio.paused&&audio.currentTime>0)).toBe(true)
  await expect.poll(async()=>{const result=await colors(page);return result.badText.length+result.badIcons.length}).toBe(0)
  const playing=await colors(page)
  await page.locator('aside a[href="/settings"]').click()
  await page.reload()
  await expect(page.getByLabel('Text color',{exact:true})).toHaveValue('#ffffff')
  await expect(page.getByLabel('Icon color',{exact:true})).toHaveValue('#ff6600')
  await expect.poll(async()=>{const result=await colors(page);return result.badText.length+result.badIcons.length}).toBe(0)
  await page.getByRole('button',{name:'Reset text color',exact:true}).click()
  await expect(page.locator('html')).toHaveAttribute('data-custom-text','false')
  await expect.poll(()=>page.locator('main h1').evaluate(element=>getComputedStyle(element).color)).not.toBe('rgb(255, 255, 255)')
  await writeFile(join(evidence,'global-colors-live-settings.json'),JSON.stringify({settings,playing,persisted:true,reset:true},null,2))
})

test('Android bridge fixture delegates real controls away from HTML audio; this is not a physical Android test',async({page})=>{
  test.setTimeout(90000)
  await setup(page)
  await page.addInitScript(()=>{
    const state={track:null,queue:[],position:0,duration:0,playing:false,playWhenReady:false,loading:false,error:'',volume:.7,muted:false,shuffle:false,repeat:'off',sleepActive:false}
    window.explicitNativeFixture={state,commands:[]}
    HTMLMediaElement.prototype.play=()=>{throw new Error('HTML playback must not run in the explicit native integration fixture')}
    const bridge={postMessage(raw){const request=JSON.parse(raw);window.explicitNativeFixture.commands.push(request);const p=request.payload;
      if(request.action==='play')Object.assign(state,{track:p.track,queue:p.queue,position:p.position||0,duration:p.track.duration,playing:true,playWhenReady:true})
      if(request.action==='pause')Object.assign(state,{playing:false,playWhenReady:false})
      if(request.action==='resume')Object.assign(state,{playing:true,playWhenReady:true})
      if(request.action==='seek')state.position=p.position
      if(request.action==='preferences')Object.assign(state,p)
      if(request.action==='next'||request.action==='previous'){const i=state.queue.findIndex(t=>t.id===state.track.id);state.track=state.queue[(i+(request.action==='next'?1:-1)+state.queue.length)%state.queue.length];state.position=0;state.playing=true;state.playWhenReady=true}
      if(request.action==='queue')state.queue=p.queue
      queueMicrotask(()=>bridge.onmessage({data:JSON.stringify({id:request.id,ok:true,state:{...state}})}))
    }}
    window.MiTuneNative=bridge
    window.explicitNativeFixture.publish=()=>bridge.onmessage({data:JSON.stringify({type:'state',state:{...state}})})
  })
  const errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  await page.goto(base+'/search')
  await page.locator('#music-search').fill('Explicit')
  await page.locator('#music-search').press('Enter')
  await page.locator('[data-search-results]').getByRole('button',{name:'Play '+songs[0].title,exact:true}).click()
  await expect(page.locator('audio')).toHaveCount(0)
  await expect.poll(()=>page.evaluate(()=>window.explicitNativeFixture.state.playWhenReady)).toBe(true)
  const player=page.getByRole('region',{name:'Music player',exact:true})
  await player.getByRole('button',{name:'Pause music',exact:true}).click()
  await expect.poll(()=>page.evaluate(()=>window.explicitNativeFixture.state.playWhenReady)).toBe(false)
  await player.getByRole('button',{name:'Play music',exact:true}).click()
  await player.getByRole('button',{name:'Next song',exact:true}).click()
  await expect.poll(()=>page.evaluate(()=>window.explicitNativeFixture.state.track.id)).toBe(songs[1].id)
  await player.getByRole('button',{name:'Previous song',exact:true}).click()
  await expect.poll(()=>page.evaluate(()=>window.explicitNativeFixture.state.track.id)).toBe(songs[0].id)
  const actions=await page.evaluate(()=>window.explicitNativeFixture.commands.map(command=>command.action))
  expect(actions).toEqual(expect.arrayContaining(['play','pause','resume','next','previous']))
  expect(errors).toEqual([])
  await writeFile(join(evidence,'native-bridge-integration.json'),JSON.stringify({fixtureOnly:true,actions},null,2))
})
