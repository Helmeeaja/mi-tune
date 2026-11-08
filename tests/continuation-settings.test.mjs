import test from 'node:test'
import assert from 'node:assert/strict'
import { isGlobalFeed, readGlobalFeed } from '../src/lib/global-feed.mjs'
import { defaultSettings, applySettings, normalizeSettings, readSettings, saveSettings } from '../src/lib/preferences.js'

const feed = { region:'ZZ',chartVersion:3,chartOrigin:'spotify',chartProvider:'spotify',chartId:'37i9dQZEVXbMDoHDwVN2tF',sourceUrl:'https://open.spotify.com/playlist/37i9dQZEVXbMDoHDwVN2tF',source:'Explicit global test fixture, not a live chart',tracks:[] }

test('global feeds reject regional and unproven caches, including on offline reopening', () => {
  const values = new Map([['mi-tune-trending',JSON.stringify({...feed,region:'ID'})]])
  const storage = {getItem:key=>values.get(key)||null,removeItem:key=>values.delete(key)}
  assert.equal(isGlobalFeed(feed),true)
  assert.equal(isGlobalFeed({...feed,region:'ID'}),false)
  assert.equal(isGlobalFeed({...feed,chartId:null}),false)
  const empty = {tracks:[]}
  assert.equal(readGlobalFeed('mi-tune-trending',empty,storage),empty)
  assert.equal(values.has('mi-tune-trending'),false)
})

test('custom card, sidebar, inset and shadow colors update without switching the selected theme, then reset cleanly', () => {
  const previousDocument=globalThis.document
  const previousMatch=globalThis.matchMedia
  const values=new Map()
  const root={dataset:{},style:{setProperty:(key,value)=>values.set(key,value),removeProperty:key=>values.delete(key)}}
  globalThis.document={documentElement:root}
  globalThis.matchMedia=()=>({matches:false})
  try {
    applySettings({...defaultSettings,theme:'dark',backgroundColor:'#000000',textColor:'#ffffff'})
    const panel=values.get('--clay-panel')
    const surface=values.get('--clay-surface')
    assert.equal(root.dataset.theme,'dark')
    assert.notEqual(panel,'#2b2825')
    assert.equal(values.get('--color-ink'),'#ffffff')
    assert.ok(values.get('--clay-sidebar')&&values.get('--clay-lyrics')&&values.get('--clay-shadow'))
    applySettings({...defaultSettings,theme:'dark',backgroundColor:'#16352a'})
    assert.equal(root.dataset.theme,'dark')
    assert.notEqual(values.get('--clay-panel'),panel)
    assert.notEqual(values.get('--clay-surface'),surface)
    applySettings(defaultSettings)
    assert.equal(root.dataset.theme,'light')
    assert.equal(values.get('--color-surface'),'#fbf8f2')
    assert.equal(values.has('--clay-panel'),false)
    assert.equal(values.has('--clay-shadow'),false)
  } finally { if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;if(previousMatch===undefined)delete globalThis.matchMedia;else globalThis.matchMedia=previousMatch }
})

test('language settings persist and unavailable device storage applies a safe session-only result', () => {
  const previous=globalThis.localStorage
  const values=new Map()
  globalThis.localStorage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)}
  try {
    assert.equal(normalizeSettings({language:'unsupported'}).language,'id')
    assert.equal(saveSettings({...defaultSettings,language:'en'}),true)
    assert.equal(readSettings().language,'en')
    globalThis.localStorage={getItem(){throw new Error('Explicit unavailable fixture storage')},setItem(){throw new Error('Explicit unavailable fixture storage')}}
    assert.equal(saveSettings({...defaultSettings,language:'en'}),false)
    assert.equal(readSettings().language,'id')
  }finally{if(previous===undefined)delete globalThis.localStorage;else globalThis.localStorage=previous}
})
