function score(id, seed) {
  let value = 2166136261
  for (const character of `${seed}:${id}`) value = Math.imul(value ^ character.charCodeAt(0), 16777619)
  return value >>> 0
}

export function rotateItems(items, seed, recent = [], group = item => item.artist || item.id, recentGroups = []) {
  const previous = new Set(Array.isArray(recent)?recent:[])
  const previousGroups = new Set(Array.isArray(recentGroups)?recentGroups:[])
  const unique = [...new Map((items || []).filter(item => item?.id).map(item => [item.id, item])).values()]
  unique.sort((a, b) => Number(previous.has(a.id)) - Number(previous.has(b.id)) || score(a.id, seed) - score(b.id, seed))
  const queues = new Map()
  for (const item of unique) {
    const key = group(item) || item.id
    if (!queues.has(key)) queues.set(key, [])
    queues.get(key).push(item)
  }
  const ordered = [...queues.values()].sort((a, b) => Number(previousGroups.has(group(a[0]))) - Number(previousGroups.has(group(b[0]))) || Number(previous.has(a[0].id)) - Number(previous.has(b[0].id)) || score(a[0].id, seed) - score(b[0].id, seed))
  const result = []
  while (ordered.some(queue => queue.length)) for (const queue of ordered) if (queue.length) result.push(queue.shift())
  return result
}

export function rotatePodcastRecommendations(data, seed, recent = {}) {
  const creators = rotateItems(data?.creators, seed, recent.creators, item => item.id)
  const order = new Map(creators.map((creator, index) => [creator.id, index]))
  const pool = [...(data?.episodes || [])].sort((a, b) => (order.get(a.creatorId) ?? 999) - (order.get(b.creatorId) ?? 999))
  const latest = new Map()
  for (const episode of [...pool].sort((a,b)=>(Date.parse(b.publishedAt)||0)-(Date.parse(a.publishedAt)||0))) {
    const group=episode.creatorId || episode.artist
    if(!latest.has(group))latest.set(group,[])
    if(latest.get(group).length<10)latest.get(group).push(episode)
  }
  const recommended = rotateItems([...latest.values()].flat(), seed, recent.episodes, item => item.creatorId || item.artist, recent.creators)
  const selected = new Set(recommended.map(episode=>episode.id))
  const episodes = [...recommended,...rotateItems(pool.filter(episode=>!selected.has(episode.id)),seed,recent.episodes,item=>item.creatorId||item.artist)]
  return { ...data, creators, episodes }
}
