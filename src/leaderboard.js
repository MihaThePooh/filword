import {accountApi,syncNow} from './cloud.js';
import {show,hide} from './sheets.js';
import {PRIZE_CATS,championsOf,equippedCats,equipPrize} from './champions.js';
import {ALL_CATS,skinsOf} from './skins.js';
import {plural} from './stats.js';
const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el};
const amount=n=>n.toLocaleString('ru-RU');
export function rankingRows(rows,total) {
  const result=[];let last=0;
  for(const row of [...rows].sort((a,b)=>a.rank-b.rank)) {
    if(row.rank<=last)continue;
    if(row.rank>last+1)result.push({gap:true});
    result.push(row);last=row.rank;
  }
  if(last<total)result.push({gap:true});
  return result;
}
export function ageLabel(row,now=Date.now()) {
  if(!row.start_known)return 'Начало игры неизвестно';
  const days=Math.max(1,Math.floor((now-Date.parse(row.tracked_since))/86400000)+1);
  return `В игре ${days} ${plural(days,'день','дня','дней')}`;
}
function portrait(cat) {
  const button=node('button',undefined,'champion-portrait');button.type='button';
  button.setAttribute('aria-label',cat.name+'. Удерживай, чтобы рассмотреть');
  const img=node('img');img.src=cat.src;img.alt=cat.name;button.append(img);
  let timer,viewer,start;
  const close=()=>{clearTimeout(timer);viewer?.remove();viewer=null};
  const zoom=()=>{
    viewer=node('div',undefined,'cat-viewer champion-viewer');const large=node('img');large.src=cat.src;large.alt=cat.name;
    const full=new Image();full.src=cat.large||cat.src;full.decode().then(()=>{if(large.isConnected)large.src=full.src}).catch(()=>{});
    // Enlarge the actual subject up to twice its old size, keeping every paw visible.
    const bounds={'prize-gold':[.61,.59,.52,.485],'prize-silver':[.54,.59,.534,.486],'prize-bronze':[.68,.38,.498,.533]}[cat.id]||[1,1];
    const size=Math.min(Math.min(innerWidth*.92,innerHeight*.85)*2,(innerWidth-24)/bounds[0],(innerHeight-32)/bounds[1]);
    large.style.width=large.style.height=size+'px';large.style.transform=`translate(${(.5-(bounds[2]??.5))*size}px,${(.5-(bounds[3]??.5))*size}px)`;viewer.append(large);document.body.append(viewer);
  };
  button.onpointerdown=e=>{start=[e.clientX,e.clientY];timer=setTimeout(zoom,500);button.setPointerCapture(e.pointerId)};
  button.addEventListener('touchmove',e=>{if(viewer){e.preventDefault();e.stopPropagation()}},{passive:false});
  button.onpointermove=e=>{if(viewer){e.stopPropagation();return}if(start&&Math.hypot(e.clientX-start[0],e.clientY-start[1])>12&&!viewer)clearTimeout(timer)};
  button.onpointerup=close;button.onpointercancel=close;button.onlostpointercapture=close;
  button.oncontextmenu=e=>e.preventDefault();button.onblur=close;
  button.onkeydown=e=>{if((e.key==='Enter'||e.key===' ')&&!e.repeat){e.preventDefault();zoom()}};
  button.onkeyup=close;
  return button;
}
export function setupLeaderboard({getStats,setStats,capacity}) {
  const wrap=node('div',undefined,'shopwrap');wrap.id='leaderwrap';wrap.hidden=true;
  const panel=node('div',undefined,'shoppanel');wrap.append(panel);const content=node('div');panel.append(content);document.body.append(wrap);
  wrap.onclick=e=>{if(e.target===wrap)hide(wrap)};
  const item=node('button','Таблица лидеров');item.type='button';item.id='leaderItem';
  item.append(node('small','Поля за всё время и призовые котики'));
  document.querySelector('#statsItem').after(item);
  let nickObserver;
  const status=node('p',undefined,'sub');status.setAttribute('role','status');
  async function open() {
    nickObserver?.disconnect();
    hide(document.querySelector('#menu'));content.replaceChildren(node('h2','Таблица лидеров'),status);
    show(wrap);status.textContent='Сохраняем прогресс и загружаем рейтинг…';
    try {
      await syncNow();const response=await accountApi('/api/leaderboard');
      if(!response.ok)throw Error(response.status===401?'Войди в аккаунт, чтобы увидеть рейтинг.':'Рейтинг пока недоступен. Попробуй ещё раз.');
      const data=await response.json();status.textContent='Места определяются по общему числу закрытых полей взрослой и детской версии. При равенстве выше более ранний результат. Рейтинг появляется после первого закрытого поля. Если ты не задавал свой ник, возьмётся небольшая часть твоей почты. Остальная часть будет закрыта звёздочками и не видна другим игрокам.';
      const form=node('form',undefined,'leader-nick');const input=node('input');input.maxLength=24;input.setAttribute('aria-label','Твой ник');
      const currentNick=data.rows.find(r=>r.self)?.nickname||'не задан';
      input.placeholder=`Твой ник сейчас: ${currentNick}`;input.title=input.placeholder;
      const field=node('div',undefined,'leader-nick-field');const hint=node('span',undefined,'leader-nick-hint');hint.setAttribute('aria-hidden','true');hint.textContent=input.placeholder;field.append(input,hint);
      const save=node('button','Сохранить');save.type='submit';form.append(field,save);content.append(form);
      const fitHint=()=>{
        const available=hint.clientWidth-16;if(available<10)return;
        const ctx=document.createElement('canvas').getContext('2d');ctx.font=`17px ${getComputedStyle(hint).fontFamily}`;
        const width=ctx.measureText(hint.textContent).width;
        let size=Math.max(12,Math.min(17,17*available/width));
        hint.style.fontSize=size.toFixed(2)+'px';
        while(hint.scrollWidth>hint.clientWidth && size>12){size=Math.max(12,size-.25);hint.style.fontSize=size.toFixed(2)+'px';}
      };
      nickObserver=new ResizeObserver(fitHint);nickObserver.observe(field);requestAnimationFrame(fitHint);
      form.onsubmit=async e=>{e.preventDefault();save.disabled=true;try{const r=await accountApi('/api/profile','PUT',{nickname:input.value});if(!r.ok){const body=await r.json();throw Error(body.error||'Не удалось сохранить ник')}await open()}catch(err){status.textContent=err.message}finally{save.disabled=false}};
      const table=node('table',undefined,'leader-table');table.setAttribute('aria-label','Рейтинг игроков');const body=node('tbody');table.append(body);
      for(const row of rankingRows(data.rows,data.total)) {
        const tr=node('tr',undefined,row.self?'leader-self':'');
        if(row.gap){tr.classList.add('leader-gap-row');const td=node('td','•••','leader-gap');td.colSpan=3;td.setAttribute('aria-label','Пропущенные места');tr.append(td)}else{
          if(row.rank<=3)tr.classList.add('leader-medal');
          const rank=node('td');const medal=PRIZE_CATS.find(c=>c.rank===row.rank);rank.append(medal?portrait(medal):node('span',String(row.rank)));
          const name=node('td',row.nickname);name.append(node('small',(row.self?'Это ты · ':'')+ageLabel(row)));
          const score=node('td',`${amount(row.shuffles)} ${plural(row.shuffles,'шафл','шафла','шафлов')}`);
          score.append(node('small',`всего ${amount(row.fields)} ${plural(row.fields,'поле','поля','полей')}`));tr.append(rank,name,score);
        }body.append(tr);
      }
      content.append(table,node('p',`Всего игроков: ${amount(data.total)}`,'leader-total'));renderPrizes(content,getStats(),setStats,capacity);
    }catch(err){status.textContent=err.message;const retry=node('button','Попробовать снова');retry.onclick=open;content.append(retry)}
  }
  item.onclick=open;
  return {open,renderAchievement(target){renderPrizes(target,getStats(),setStats,capacity)}};
}
function renderPrizes(target,stats,setStats,capacity) {
  const earned=championsOf(stats).owned;
  const box=node('section',undefined,'champions-section');const heading=node('h3','Чемпионы');
  const stars=node('span','★'.repeat(earned.length)+'☆'.repeat(3-earned.length),'astars');stars.setAttribute('aria-label',`Получено ${earned.length} из 3 звёзд`);heading.append(stars);box.append(heading);
  box.append(node('p','Призы выдаются навсегда за первое достижение места: бронза — третье, серебро — второе, золото — первое. Каждый этап даёт котика, звезду и монеты один раз. Первое место сразу открывает все три этапа: 55 000 монет.','sub'));
  if(capacity===25)box.append(node('p','Призовые монеты поступают во взрослую версию игры. Котиков можно добавить в обеих версиях.','sub'));
  box.append(node('p','Любого из выигранных котиков можно поставить на поле. Нажми «Добавить на поле» и выбери обычного котика, которого хочешь заменить. Если есть свободное место, призовой котик добавится сразу. Прежний котик останется в коллекции. Удерживай котика, чтобы рассмотреть его на весь экран.','sub'));
  for(const cat of [...PRIZE_CATS].sort((a,b)=>a.rank-b.rank)){
    const row=node('div',undefined,'champion-card');row.append(portrait(cat));const description=node('div',cat.name);description.append(node('small',`Место ${cat.rank} · ${amount(cat.coins)} монет`));row.append(description);
    if(earned.includes(cat.id)){
      description.append(node('small','Получен навсегда'));
      const equipped=equippedCats(stats,skinsOf(stats).owned,capacity);const button=node('button',equipped.includes(cat.id)?'На поле':'Добавить на поле');button.disabled=equipped.includes(cat.id);button.type='button';
      button.onclick=()=>{
        if(equipped.length<capacity){const next=equipPrize(stats,skinsOf(stats).owned,cat.id,null,capacity);setStats(next,null,cat.id);box.remove();renderPrizes(target,next,setStats,capacity);return}
        let chooser=box.querySelector('.champion-replace');chooser?.remove();chooser=node('div',undefined,'champion-replace');chooser.append(node('h4','Кого заменить?'),node('p','Выбранный котик останется в коллекции. Остальные котики на поле сохранят свои места.','sub'));
        const grid=node('div',undefined,'champion-choices');for(const id of equipped){const old=ALL_CATS.find(c=>c.id===id);const choice=node('button');choice.type='button';choice.dataset.cat=id;const img=node('img');img.src=old.src;img.alt=old.name;choice.append(img,node('small',old.name));choice.onclick=()=>{const next=equipPrize(stats,skinsOf(stats).owned,cat.id,id,capacity);setStats(next,id,cat.id);box.remove();renderPrizes(target,next,setStats,capacity)};grid.append(choice)}
        const cancel=node('button','Отмена');cancel.type='button';cancel.onclick=()=>chooser.remove();chooser.append(grid,cancel);box.append(chooser);chooser.scrollIntoView({block:'nearest',behavior:'smooth'});
      };row.append(button);
    }else row.append(node('small','Ещё не получен'));
    box.append(row);
  }target.append(box);
}
