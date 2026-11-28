// Permanent account awards stay separate from the 64 purchasable cats.
export const PRIZE_CATS = ['bronze','silver','gold'].map((metal,i) => ({
  id:'prize-'+metal, name:['Бронзовый чемпион','Серебряный чемпион','Золотой чемпион'][i],
  rank:3-i, coins:[10000,15000,30000][i],
  src:`data/skins/normalized-v86/prize-${metal}.svg`, large:`data/skins/normalized-v86/prize-${metal}-large.svg`,
  disc:{x:50,y:50},
}));
export function championsOf(stats) {
  const c=stats?.champions;
  return {owned:PRIZE_CATS.filter(cat=>c?.owned?.includes(cat.id)).map(cat=>cat.id),credit:Number(c?.credit)||0};
}
export function equippedCats(stats, regular, capacity=64) {
  const owned=[...regular,...championsOf(stats).owned];
  const requested=stats?.skins?.equipped;
  return [...new Set(Array.isArray(requested)?requested.filter(id=>owned.includes(id)):regular)].slice(0,capacity);
}
export function equipCat(stats, regular, id, replace=null, capacity=64) {
  if(![...regular,...championsOf(stats).owned].includes(id)) return null;
  const equipped=equippedCats(stats,regular,capacity);
  if(equipped.includes(id)) return {...stats,skins:{...stats.skins,equipped,active:'cats'}};
  if(equipped.length>=capacity) {
    const index=equipped.indexOf(replace);
    if(index<0) return null;
    equipped[index]=id;
  } else equipped.push(id);
  return {...stats,skins:{...stats.skins,equipped,active:'cats'}};
}
export function removeCat(stats, regular, id, capacity=64) {
  return {...stats,skins:{...stats.skins,equipped:equippedCats(stats,regular,capacity).filter(cat=>cat!==id)}};
}
export function equipPrize(stats, regular, id, replace=null, capacity=64) {
  return championsOf(stats).owned.includes(id)?equipCat(stats,regular,id,replace,capacity):null;
}
export function replacePlannedCat(state,oldId,newId) {
  return {...state,plan:(state?.plan||[]).map(([word,cell,id])=>[word,cell,id===oldId?newId:id]),
    placed:(state?.placed||[]).map(([cell,id])=>[cell,id===oldId?newId:id])};
}
