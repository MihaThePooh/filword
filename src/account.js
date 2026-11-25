import {accountDetails} from './cloud.js';
import {show,hide} from './sheets.js';
const make=(tag,text,cls)=>{const el=document.createElement(tag);if(text)el.textContent=text;if(cls)el.className=cls;return el};
export function setupAccount(){
 const item=make('button','Аккаунт');item.id='accountItem';item.type='button';const summary=make('small','Почта и синхронизация');item.append(summary);
 document.querySelector('#menu .menu-sheet').prepend(item);
 const wrap=make('div',null,'shopwrap');wrap.id='accountwrap';wrap.hidden=true;const panel=make('div',null,'shoppanel');const content=make('div');panel.append(content);wrap.append(panel);document.body.append(wrap);
 wrap.onclick=e=>{if(e.target===wrap)hide(wrap)};
 let fetching;
 const refresh=()=>{
  if(fetching)return fetching;
  summary.textContent='Проверяем аккаунт…';
  fetching=accountDetails().then(info=>{
   const labels={synced:'Данные синхронизированы',pending:'Есть изменения на устройстве — синхронизация ещё не завершена',newer:'На сервере есть более свежее сохранение',changed:'Аккаунт изменился. Загрузи его сохранение',offline:'Без интернета: показан последний аккаунт этого устройства',unavailable:'Не удалось подтвердить вход. Показаны последние известные данные', 'signed-out':'Нужно войти повторно'};
   const confirmed=['synced','pending','newer','changed'].includes(info.state);
   summary.textContent=info.email?(confirmed?info.email:'Последний: '+info.email):labels[info.state];
   content.replaceChildren(make('h2','Аккаунт'),make('p',confirmed?'Ты вошёл под этой почтой:':info.email?'Последний подтверждённый аккаунт на устройстве:':'Вход сейчас не подтверждён','sub'),make('p',info.email||'Почта пока не подтверждена','account-email'),make('p',labels[info.state],'sub'));
   const update=make('button',info.state==='newer'||info.state==='changed'?'Загрузить сохранение':'Обновить данные','account-refresh');update.type='button';update.onclick=()=>info.state==='newer'||info.state==='changed'?location.reload():refresh();content.append(update);
  }).finally(()=>{fetching=null});return fetching;
 };
 window.addEventListener('filword-account-ready',refresh);
 document.querySelector('#burger').addEventListener('click',()=>{if(document.querySelector('#menu').hidden===false)refresh()});
 item.onclick=()=>{hide(document.querySelector('#menu'));content.replaceChildren(make('h2','Аккаунт'),make('p','Проверяем вход…','sub'));show(wrap);refresh()};
}
