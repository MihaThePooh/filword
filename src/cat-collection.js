// Cosmetic rewards are planned once per board and saved with it.
export function planCats(wordCount, owned, random = Math.random) {
  const shuffle = list => {
    for (let i=list.length-1;i>0;i--) { const j=Math.floor(random()*(i+1)); [list[i],list[j]]=[list[j],list[i]]; }
    return list;
  };
  const cats=shuffle([...new Set(owned)]);
  if (!cats.length || !wordCount) return [];
  const words=shuffle(Array.from({length:wordCount},(_,i)=>i));
  const count=Math.min(cats.length, Math.max(1,words.filter(()=>random()<.35).length));
  return words.slice(0,count).map((word,i)=>[word,cats[i]]);
}
export function revealCat(state, word, cells, random = Math.random) {
  const id=state.plan.find(([i])=>i===word)?.[1];
  if (!id || state.placed.some(([,cat])=>cat===id)) return;
  const available=cells.filter(cell=>!state.placed.some(([at])=>at===cell));
  if (available.length) state.placed.push([available[Math.floor(random()*available.length)],id]);
}
