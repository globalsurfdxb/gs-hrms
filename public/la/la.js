/* Leave & Attendance prototype runtime — extracted from gsit-attendance-leave-ui_V2_0.html.
   DOM lookups are routed through the isolated container (window.__laRoot); the app renders the rail,
   scope tabs and sub-tabs itself from the state published by __chromeState(). */
const __$ = (id) => (window.__laRoot ? window.__laRoot.getElementById(id) : null);
const __$$ = (sel) => (window.__laRoot ? window.__laRoot.querySelectorAll(sel) : []);
/* ============================================================
   GSIT HRMS — Attendance & Leave Management  (UI Prototype V1.0)
   Single-file SPA. No frameworks. Mock data only.
   Design ref: Zoho People (not copied). Content: GSIT FRS 2024.
   ============================================================ */

/* ---------- ICONS ---------- */
const IC = {
  grid:'M3 3h8v8H3zM13 3h8v8h-8zM13 13h8v8h-8zM3 13h8v8H3z',
  calendar:'M3 4h18v18H3zM16 2v4M8 2v4M3 10h18',
  clock:'M12 22a10 10 0 100-20 10 10 0 000 20zM12 6v6l4 2',
  edit:'M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z',
  swap:'M7 4v13M4 7l3-3 3 3M17 20V7M14 17l3 3 3-3',
  wallet:'M3 7h18v12H3zM3 7l2-3h14l2 3M16 13h2',
  plan:'M9 11l3 3 8-8M20 12v6a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h9',
  history:'M3 3v5h5M3.05 13A9 9 0 106 5.3L3 8M12 7v5l3 3',
  clock2:'M12 22a10 10 0 100-20 10 10 0 000 20zM12 6v6l4 2',
  gift:'M20 12v10H4V12M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z',
  sun:'M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4M12 8a4 4 0 100 8 4 4 0 000-8z',
  users:'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8',
  usercheck:'M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M8.5 11a4 4 0 100-8 4 4 0 000 8zM17 11l2 2 4-4',
  inbox:'M22 12h-6l-2 3h-4l-2-3H2M5.5 5h13l3.5 7v6a2 2 0 01-2 2H4a2 2 0 01-2-2v-6z',
  chart:'M3 3v18h18M7 15l4-4 3 3 5-6',
  pie:'M21.2 15.9A10 10 0 118.1 2.8M22 12A10 10 0 0012 2v10z',
  alert:'M10.3 3.9l-8 14A2 2 0 004 21h16a2 2 0 001.7-3l-8-14a2 2 0 00-3.4 0zM12 9v4M12 17h.01',
  shield:'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  doc:'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M9 13h6M9 17h6',
  gear:'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-2.7 1.1V21a2 2 0 11-4 0v-.1a1.6 1.6 0 00-2.7-1.1l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00-1.1-2.7H3a2 2 0 110-4h.1A1.6 1.6 0 004.2 8.5l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 001.8.3H9a1.6 1.6 0 001-1.5V4a2 2 0 114 0v.1a1.6 1.6 0 001 1.5 1.6 1.6 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 00-.3 1.8V9a1.6 1.6 0 001.5 1H21a2 2 0 110 4h-.1a1.6 1.6 0 00-1.5 1z',
  building:'M3 21h18M5 21V7l7-4 7 4v14M9 9h.01M9 13h.01M9 17h.01M15 9h.01M15 13h.01M15 17h.01',
  device:'M4 4h16v12H4zM2 20h20M9 8h6',
  plug:'M9 2v6M15 2v6M6 8h12v3a6 6 0 01-12 0zM12 17v5',
  lock:'M5 11h14v10H5zM8 11V7a4 4 0 018 0v4',
  key:'M21 2l-2 2m-7.6 7.6a5 5 0 11-7 7 5 5 0 017-7zM15 7l4 4M18 4l3 3',
  file:'M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9zM13 2v7h7',
  download:'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3',
  filter:'M22 3H2l8 9.5V19l4 2v-8.5z',
  check:'M20 6L9 17l-5-5',
  x:'M18 6L6 18M6 6l12 12',
  chevL:'M15 18l-6-6 6-6', chevR:'M9 18l6-6-6-6',
  plus:'M12 5v14M5 12h14',
  logout:'M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9',
  bell:'M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0',
  flame:'M8.5 14.5A3.5 3.5 0 0012 18a3.5 3.5 0 003.5-3.5c0-1.5-1-2.5-1-4 0-2-1.5-3.5-3.5-6.5-1 3-4 4-4.5 7 0 1 .5 2 2 3.5z',
  home:'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z',
  location:'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0zM12 13a3 3 0 100-6 3 3 0 000 6z',
  briefcase:'M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2zM16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2M2 13h20',
  refresh:'M23 4v6h-6M1 20v-6h6M3.5 9a9 9 0 0114.9-3.4L23 10M1 14l4.6 4.4A9 9 0 0020.5 15',
  lockOpen:'M5 11h14v10H5zM8 11V7a4 4 0 018 0',
  scale:'M12 3v18M3 7h18M6 7l-3 7a3 3 0 006 0zM18 7l3 7a3 3 0 01-6 0z',
  baby:'M9 12h.01M15 12h.01M10 16s.8 1 2 1 2-1 2-1M12 2a5 5 0 015 5v3a5 5 0 01-10 0V7a5 5 0 015-5z',
  book:'M4 19.5A2.5 2.5 0 016.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z',
};
function ic(n,cls){return `<svg class="ic ${cls||''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${(IC[n]||'').split('M').filter(Boolean).map(p=>'<path d="M'+p+'"/>').join('')}</svg>`}

/* ---------- STATUS BADGE MAP (from FRS §6 Attendance Status Master) ---------- */
const ST = {
  Present:['s-g','Present'], Absent:['s-r','Absent'], 'Unauthorized Absence':['s-r','Unauth. Absence'],
  'Half Day':['s-a','Half Day'], 'First Half Present':['s-a','First Half'], 'Second Half Present':['s-a','Second Half'],
  'Late Login':['s-a','Late Login'], 'Approved Late Login':['s-b','Appr. Late'], 'Unscheduled Late Login':['s-r','Unsch. Late'],
  'Early Departure':['s-a','Early Dep.'], 'Approved Early Departure':['s-b','Appr. Early'], 'Unscheduled Early Departure':['s-r','Unsch. Early'],
  'Weekly Off':['s-gray','Weekly Off'], 'Public Holiday':['s-p','Public Holiday'],
  'Annual Leave':['s-b','Annual Leave'], 'Sick Leave':['s-b','Sick Leave'], 'Maternity Leave':['s-b','Maternity'],
  'Parental Leave':['s-b','Parental'], 'Compassionate Leave':['s-b','Compassionate'], 'Study Leave':['s-b','Study'],
  'Hajj Leave':['s-b','Hajj'], 'Umrah Leave':['s-b','Umrah'], 'Restricted Festive Holiday':['s-p','Festive'],
  'Unpaid Leave':['s-gray','Unpaid'], 'Loss of Pay':['s-r','Loss of Pay'], 'On Duty':['s-p','On Duty'],
  'Work from Home':['s-p','WFH'], 'Business Travel':['s-p','Travel'], 'Client Site':['s-p','Client Site'],
  'Compensatory Off':['s-g','Comp-Off'], Overtime:['s-g','Overtime'], 'Missing Check-In':['s-a','Miss Check-In'],
  'Missing Check-Out':['s-a','Miss Check-Out'], 'Attendance Pending':['s-gray','Pending'],
  'Regularization Pending':['s-a','Reg. Pending'], 'Not Yet Joined':['s-gray','Not Joined'], Relieved:['s-gray','Relieved'],
};
function statusBadge(s){const m=ST[s]||['s-gray',s];return `<span class="bdg ${m[0]}"><span class="d"></span>${m[1]}</span>`}
function bdg(cls,txt){return `<span class="bdg ${cls}">${txt}</span>`}

/* ---------- MOCK DATA ---------- */
const ME = {name:'Afzal Rahman', id:'GSIT-0142', dept:'Software Development', desig:'Senior Engineer', shift:'General (08:00–18:00)', doj:'12 Mar 2022', mgr:'Nabeel Kurup'};

const EMP = [
  {n:'Afzal Rahman',id:'GSIT-0142',dept:'Software Dev',desig:'Sr. Engineer',in:'08:04',out:'—',st:'Late Login',hrs:'—',late:4,early:0},
  {n:'Sara Menon',id:'GSIT-0138',dept:'Software Dev',desig:'Engineer',in:'07:56',out:'—',st:'Present',hrs:'—',late:0,early:0},
  {n:'Rohit Nair',id:'GSIT-0155',dept:'Software Dev',desig:'QA Lead',in:'—',out:'—',st:'Annual Leave',hrs:'—',late:0,early:0},
  {n:'Fatima Ali',id:'GSIT-0121',dept:'Software Dev',desig:'Engineer',in:'08:00',out:'—',st:'Present',hrs:'—',late:0,early:0},
  {n:'James Peter',id:'GSIT-0163',dept:'Software Dev',desig:'DevOps',in:'—',out:'—',st:'Sick Leave',hrs:'—',late:0,early:0},
  {n:'Aisha Khan',id:'GSIT-0147',dept:'Software Dev',desig:'Designer',in:'08:22',out:'—',st:'Unscheduled Late Login',hrs:'—',late:22,early:0},
  {n:'Deepak R.',id:'GSIT-0159',dept:'Software Dev',desig:'Engineer',in:'—',out:'—',st:'Work from Home',hrs:'—',late:0,early:0},
  {n:'Layla Hassan',id:'GSIT-0130',dept:'Software Dev',desig:'BA',in:'—',out:'—',st:'Unauthorized Absence',hrs:'—',late:0,early:0},
];
const initials=n=>n.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase();
function personCell(n,sub){return `<div class="person"><div class="avatar">${initials(n)}</div><div><div class="pn">${n}</div><div class="pm">${sub||''}</div></div></div>`}

const LEAVE_BAL = [
  {t:'Annual Leave',code:'AL',cls:'s-b',accrued:12.5,used:5,pending:2,avail:5.5,unit:'days',cap:30,note:'Accrues 2.5 days / eligible month'},
  {t:'Sick Leave',code:'SL',cls:'s-b',accrued:90,used:3,pending:0,avail:87,unit:'days',cap:90,note:'90/yr · 15 full · 30 half · 45 unpaid'},
  {t:'Compassionate',code:'CL',cls:'s-b',accrued:5,used:0,pending:0,avail:5,unit:'days',cap:5,note:'Per bereavement event'},
  {t:'Study Leave',code:'ST',cls:'s-b',accrued:5,used:0,pending:0,avail:5,unit:'days',cap:5,note:'Min 2 yrs service'},
  {t:'Restricted Festive',code:'RF',cls:'s-p',accrued:1,used:0,pending:0,avail:1,unit:'day',cap:1,note:'1 paid/yr'},
  {t:'Comp-Off',code:'CO',cls:'s-g',accrued:2,used:1,pending:0,avail:1,unit:'days',cap:null,note:'Ratio pending HR confirmation'},
];
const LEAVE_APPS = [
  {id:'LV-2041',emp:'Afzal Rahman',type:'Annual Leave',from:'18 Aug 2025',to:'26 Aug 2025',days:9,st:'Pending',stage:'Reporting Manager',applied:'02 Jul 2025',reason:'Family visit — planned segment 2 of 3'},
  {id:'LV-2038',emp:'Afzal Rahman',type:'Sick Leave',from:'09 Jun 2025',to:'09 Jun 2025',days:1,st:'Approved',stage:'Completed',applied:'09 Jun 2025',reason:'Fever — prescription attached (instance 3 of 6)'},
  {id:'LV-2033',emp:'Afzal Rahman',type:'Annual Leave',from:'02 Feb 2025',to:'06 Feb 2025',days:5,st:'Approved',stage:'Completed',applied:'20 Dec 2024',reason:'Personal'},
  {id:'LV-2029',emp:'Afzal Rahman',type:'Compassionate Leave',from:'—',to:'—',days:0,st:'Rejected',stage:'HR',applied:'11 Nov 2024',reason:'Document not eligible per policy'},
];
const TEAM_LEAVE = [
  {id:'LV-2041',emp:'Afzal Rahman',type:'Annual Leave',from:'18 Aug',to:'26 Aug',days:9,st:'Pending',doc:'—',reason:'Family visit'},
  {id:'LV-2044',emp:'Sara Menon',type:'Sick Leave',from:'28 Jul',to:'29 Jul',days:2,st:'Pending',doc:'Medical cert required',reason:'Flu (2 consecutive days)'},
  {id:'LV-2045',emp:'Rohit Nair',type:'Annual Leave',from:'14 Jul',to:'22 Jul',days:9,st:'Approved',doc:'—',reason:'Vacation'},
  {id:'LV-2047',emp:'Aisha Khan',type:'Restricted Festive',from:'05 Aug',to:'05 Aug',days:1,st:'Pending',doc:'—',reason:'Onam'},
];
const REQUESTS = [
  {id:'RG-981',type:'Regularization',date:'25 Jul 2025',detail:'Missing check-out — biometric failure',st:'Pending',stage:'Reporting Manager'},
  {id:'RG-977',type:'Late Login (Scheduled)',date:'22 Jul 2025',detail:'Prior notice — clinic appointment',st:'Approved',stage:'Completed'},
  {id:'RG-970',type:'Shift Change',date:'18 Jul 2025',detail:'Swap to client-site shift',st:'Approved',stage:'Completed'},
  {id:'RG-965',type:'Early Departure',date:'15 Jul 2025',detail:'Left 45 min early — no prior request',st:'Rejected',stage:'HR'},
];
const OCCURRENCES = [
  {emp:'Aisha Khan',id:'GSIT-0147',type:'Unscheduled Late Login',count:5,thr:6,window:'Rolling 12 mo',action:'Approaching occurrence',cls:'s-a'},
  {emp:'Layla Hassan',id:'GSIT-0130',type:'Unauthorized Absence',count:1,thr:1,window:'Rolling 12 mo',action:'First Written Warning (recommended)',cls:'s-r'},
  {emp:'Afzal Rahman',id:'GSIT-0142',type:'Pattern Absence',count:2,thr:5,window:'Rolling 12 mo',action:'Under watch',cls:'s-gray'},
];
const HOLIDAYS = [
  {d:'01 Jan 2025',n:'New Year’s Day',type:'Public'},
  {d:'30 Mar–01 Apr 2025',n:'Eid Al Fitr',type:'Public'},
  {d:'05 Jun–08 Jun 2025',n:'Arafat Day & Eid Al Adha',type:'Public'},
  {d:'27 Jun 2025',n:'Islamic New Year',type:'Public'},
  {d:'05 Sep 2025',n:'Prophet’s Birthday',type:'Public'},
  {d:'01 Dec 2025',n:'Commemoration Day',type:'Public'},
  {d:'02–03 Dec 2025',n:'UAE National Day',type:'Public'},
];
const LEAVE_TYPES = [
  {t:'Annual Leave',code:'AL',pay:'Full',ent:'30 cal days/yr',accrual:'2.5/mo',probation:'After probation',doc:'—'},
  {t:'Sick Leave',code:'SL',pay:'Tiered',ent:'90/yr (15F/30H/45U)',accrual:'Calendar year',probation:'Not paid',doc:'Cert (conditional)'},
  {t:'Compassionate',code:'CP',pay:'Full',ent:'3–5 days',accrual:'Per event',probation:'Eligible',doc:'Mandatory'},
  {t:'Maternity',code:'MT',pay:'45F + 15H',ent:'60 days',accrual:'Per event',probation:'Eligible',doc:'Mandatory'},
  {t:'Parental',code:'PT',pay:'Full',ent:'5 working days',accrual:'Per birth',probation:'Eligible',doc:'Mandatory'},
  {t:'Hajj',code:'HJ',pay:'Unpaid',ent:'Max 30 days',accrual:'Once in employment',probation:'Eligible',doc:'Evidence'},
  {t:'Umrah',code:'UM',pay:'From AL/Unpaid',ent:'HR selection',accrual:'—',probation:'Eligible',doc:'Evidence'},
  {t:'Study',code:'ST',pay:'Full',ent:'5 days/yr',accrual:'Calendar year',probation:'Min 2 yrs service',doc:'Exam evidence'},
  {t:'Restricted Festive',code:'RF',pay:'Full',ent:'1 day/yr',accrual:'Calendar year',probation:'Eligible',doc:'—'},
  {t:'Unpaid Leave',code:'UP',pay:'Unpaid',ent:'As approved',accrual:'—',probation:'Eligible',doc:'Reason'},
];

/* ---------- COMPONENT HELPERS ---------- */
function kpi(o){return `<div class="kpi ${o.acc?'acc-'+o.acc:''}">
  <div class="k-top"><div class="k-ic">${ic(o.icon)}</div>${o.trend?`<span class="k-trend" style="color:${o.trend[0]==='+'?'var(--g)':'var(--r)'}">${o.trend}</span>`:''}</div>
  <div class="k-val">${o.val}</div><div class="k-lbl">${o.lbl}</div></div>`}
function card(title,body,opts={}){return `<div class="card">${title?`<div class="card-h"><h3>${title}</h3>${opts.sub?`<span class="sub">${opts.sub}</span>`:''}${opts.actions?`<div class="ca">${opts.actions}</div>`:''}</div>`:''}<div class="card-b" ${opts.pad===false?'style="padding:0"':''}>${body}</div></div>`}
function tableCard(title,head,rows,opts={}){
  const th=head.map(h=>`<th class="${/^(num|Days|Count|Hours|Balance|Amount)/.test(h)?'num':''}">${h}</th>`).join('');
  return card(title,`<div class="tbl-wrap"><table class="tbl"><thead><tr>${th}</tr></thead><tbody>${rows}</tbody></table></div>`,{...opts,pad:false});
}
function note(kind,html){return `<div class="note ${kind}">${ic(kind==='warn'?'alert':'shield')}<div>${html}</div></div>`}
function phFlag(txt){return `<span class="ph-flag">${ic('alert')} ${txt}</span>`}
function pageHead(title,sub,actions,crumb){return `<div class="page-head"><div>
  ${crumb?`<div class="crumb">${crumb}</div>`:''}<h1>${title}</h1>${sub?`<div class="sub">${sub}</div>`:''}</div>
  ${actions?`<div class="ph-actions">${actions}</div>`:''}</div>`}
function bar(pct,color){return `<div class="bar"><i style="width:${Math.min(100,pct)}%;${color?'background:'+color:''}"></i></div>`}
function tabs(items,active,fn){return `<div class="tabs">${items.map(t=>`<div class="tab ${t.k===active?'active':''}" onclick="${fn}('${t.k}')">${t.l}</div>`).join('')}</div>`}

/* ---------- ROLES ---------- */
const ROLES = {
  employee:{name:'Employee', person:'Afzal Rahman', av:'AF', label:'Employee'},
  manager:{name:'Manager', person:'Nabeel Kurup', av:'NK', label:'Reporting Manager'},
  hr:{name:'HR', person:'Mariam Yousef', av:'MY', label:'HR Administrator'},
  admin:{name:'Super Admin', person:'System Owner', av:'SO', label:'Super Administrator'},
};
let ROLE='employee', VIEW='emp-dash';


/* ============================================================
   CALENDAR ENGINE (shared)
   ============================================================ */
let calState={y:2025,m:6}; // July 2025
const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
const DOW=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
function calMove(d){calState.m+=d; if(calState.m<0){calState.m=11;calState.y--} if(calState.m>11){calState.m=0;calState.y++} route();}
function calGrid(tagFn){
  const {y,m}=calState, first=new Date(y,m,1).getDay(), days=new Date(y,m+1,0).getDate();
  const prev=new Date(y,m,0).getDate();
  let cells='';
  for(let i=0;i<first;i++){cells+=`<div class="cal-cell out"><div class="dnum">${prev-first+i+1}</div></div>`}
  for(let d=1;d<=days;d++){
    const dow=new Date(y,m,d).getDay(), wo=(dow===0||dow===6);
    const today=(y===2025&&m===6&&d===29);
    const tags=(tagFn?tagFn(d,dow):[])||[];
    cells+=`<div class="cal-cell ${wo?'wo':''} ${today?'today':''}"><div class="dnum">${d}</div>${tags.map(t=>`<span class="cal-tag ${t.cls}">${t.txt}</span>`).join('')}</div>`;
  }
  const total=first+days, tail=(7-total%7)%7;
  for(let i=1;i<=tail;i++){cells+=`<div class="cal-cell out"><div class="dnum">${i}</div></div>`}
  return `<div class="cal">
    <div class="cal-h"><b>${MONTHS[m]} ${y}</b>
      <div class="cal-nav"><button onclick="calMove(-1)">${ic('chevL')}</button><button onclick="calMove(1)">${ic('chevR')}</button></div>
    </div>
    <div class="cal-grid">${DOW.map(d=>`<div class="cal-dow">${d}</div>`).join('')}${cells}</div>`;
}
const calLegend=(items)=>`<div class="legend">${items.map(i=>`<span><i style="background:${i.c}"></i>${i.l}</span>`).join('')}</div></div>`;

/* attendance mock pattern for a month */
function attStatus(d,dow){
  if(dow===0||dow===6)return [{cls:'s-gray',txt:'Weekly Off'}];
  const map={1:'Public Holiday',4:'Late Login',9:'Sick Leave',10:'Present',15:'WFH',18:'Late Login',22:'Present',24:'Present',25:'Reg. Pending'};
  const c={'Public Holiday':'s-p','Late Login':'s-a','Sick Leave':'s-b','WFH':'s-p','Reg. Pending':'s-a','Present':'s-g'};
  if(d>29)return [{cls:'s-gray',txt:'—'}];
  const st=map[d]||'Present';
  return [{cls:c[st]||'s-g',txt:st}];
}

/* ============================================================
   VIEWS
   ============================================================ */
const VIEWS = {};

/* ---------------- EMPLOYEE ---------------- */
VIEWS['emp-dash']=()=>({html:
  pageHead('My Dashboard','Tuesday, 29 July 2025 · '+ME.shift,
    `<button class="btn" onclick="go('my-attendance')">${ic('calendar')} Attendance</button><button class="btn pri" onclick="go('checkin')">${ic('clock')} Check-In / Out</button>`,
    'My Space')
  +`<div class="grid g-4" style="margin-bottom:16px">
    ${kpi({icon:'clock',acc:'g',val:'08:04',lbl:'Checked in today',trend:'Late Login'})}
    ${kpi({icon:'clock2',acc:'b',val:'—',lbl:'Working hours today'})}
    ${kpi({icon:'alert',acc:'a',val:'4 min',lbl:'Late minutes today'})}
    ${kpi({icon:'wallet',acc:'p',val:'5.5',lbl:'Annual leave available'})}
  </div>
  <div class="row">
    <div style="flex:2">${card('Leave balances',
      LEAVE_BAL.slice(0,4).map(b=>`<div style="margin-bottom:14px"><div class="mini-stat"><span>${bdg(b.cls,b.code)} ${b.t}</span><b>${b.avail} / ${b.cap??'∞'} ${b.unit}</b></div>${bar(b.cap?(b.avail/b.cap*100):40)}</div>`).join(''),
      {actions:`<button class="btn sm ghost" onclick="go('leave-balances')">View all</button>`})}
    </div>
    <div style="flex:1.4">${card('Upcoming & pending',
      `<div class="lrow"><div class="li-ic s-b" style="background:var(--b-bg);color:var(--b)">${ic('calendar')}</div><div><div class="li-t">Annual Leave</div><div class="li-s">18–26 Aug · 9 days</div></div><div class="li-r">${bdg('s-a','Pending')}</div></div>
       <div class="lrow"><div class="li-ic" style="background:var(--a-bg);color:var(--a)">${ic('edit')}</div><div><div class="li-t">Regularization RG-981</div><div class="li-s">Missing check-out</div></div><div class="li-r">${bdg('s-a','Pending')}</div></div>
       <div class="lrow"><div class="li-ic" style="background:var(--g-bg);color:var(--g)">${ic('clock2')}</div><div><div class="li-t">Comp-Off credit</div><div class="li-s">1 day available</div></div><div class="li-r">${bdg('s-g','Ready')}</div></div>`)}
    </div>
  </div>
  <div class="row" style="margin-top:16px">
    <div style="flex:1">${card('This month at a glance',
      `<div class="grid g-3" style="gap:12px">
        <div><div class="k-val" style="font-size:22px">20</div><div class="muted">Present days</div></div>
        <div><div class="k-val" style="font-size:22px;color:var(--a)">2</div><div class="muted">Late logins</div></div>
        <div><div class="k-val" style="font-size:22px;color:var(--b)">1</div><div class="muted">Sick instance (of 6)</div></div>
      </div><div class="divider"></div>
      ${note('info','<b>Annual leave expiry:</b> 2.0 carry-forward days expire on <b>31 Mar 2026</b>. Use or request encashment before expiry.')}`)}
    </div>
    <div style="flex:1">${card('My occurrence summary',
      `<div class="mini-stat"><span>Pattern absence</span><b>2 / 5</b></div>${bar(40,'var(--a)')}
       <div style="height:12px"></div><div class="mini-stat"><span>Unscheduled late login</span><b>0 / 6</b></div>${bar(0)}
       <div class="divider"></div><div class="muted" style="font-size:12.5px">Occurrences are evaluated over a rolling 12-month period. No active warnings on record.</div>`,
      {sub:'Rolling 12 months'})}
    </div>
  </div>`
});

VIEWS['checkin']=()=>({html:
  pageHead('Check-In / Out','Web attendance capture · '+ME.shift,'','Attendance')
  +`<div class="row">
    <div style="flex:1;max-width:420px">${card('',`
      <div class="clock"><div class="time" id="liveClock">08:04:22</div><div class="date">Tuesday, 29 July 2025</div></div>
      <button class="punch-btn out" id="punchBtn" onclick="togglePunch()"><span>Check Out</span><small id="punchSub">Checked in at 08:04</small></button>
      <div class="dl" style="margin-top:8px">
        <dt>Status</dt><dd id="punchStatus">${statusBadge('Late Login')}</dd>
        <dt>Shift</dt><dd>General · 08:00–18:00</dd>
        <dt>Captured via</dt><dd>Web · IP 10.20.4.18 · Chrome / Windows</dd>
        <dt>Location</dt><dd>GSIT Dubai (approved network)</dd>
      </div>`)}
    </div>
    <div style="flex:1.3">${card('Today’s punches',
      `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Time</th><th>Type</th><th>Channel</th><th>Device / IP</th><th>Status</th></tr></thead>
      <tbody id="punchLog">
        <tr><td class="mono">08:04:11</td><td>Check-In</td><td>Web</td><td class="mono">10.20.4.18</td><td>${bdg('s-a','Late (4 min)')}</td></tr>
      </tbody></table></div>`,
      {sub:'Raw records are preserved and never overwritten'})}
      <div style="height:16px"></div>
      ${note('info','Attendance can also be captured via <b>biometric</b>, <b>mobile (GPS + geofence + optional photo)</b>, <b>bulk Excel/CSV import</b> and <b>API</b>. Every modification preserves the original transaction (FRS §5).')}
    </div>
  </div>`,
  mount(){startClock();}
});

VIEWS['my-attendance']=()=>({html:
  pageHead('My Attendance','Monthly calendar, working hours and deviations',
    `<button class="btn" onclick="toast('Export is inert in this prototype')">${ic('download')} Export</button><button class="btn pri" onclick="go('regularization')">${ic('edit')} Regularize</button>`,'Attendance')
  +`<div class="grid g-4" style="margin-bottom:16px">
    ${kpi({icon:'check',acc:'g',val:'20',lbl:'Present days'})}
    ${kpi({icon:'alert',acc:'a',val:'2',lbl:'Late logins'})}
    ${kpi({icon:'clock2',acc:'b',val:'168.5',lbl:'Net working hours'})}
    ${kpi({icon:'x',acc:'r',val:'0',lbl:'Unauthorized absence'})}
  </div>`
  +calGrid(attStatus)
  +calLegend([{c:'var(--g)',l:'Present'},{c:'var(--a)',l:'Late / Regularize'},{c:'var(--b)',l:'Leave'},{c:'var(--p)',l:'WFH / Holiday'},{c:'var(--gray)',l:'Weekly Off'}])
});

VIEWS['regularization']=()=>{
  const rows=REQUESTS.filter(r=>r.type==='Regularization').concat([{id:'RG-960',type:'Regularization',date:'10 Jul 2025',detail:'Client site — no punch',st:'Approved',stage:'Completed'}]);
  return pageHead('Attendance Regularization','Correct missing punches, wrong shift or off-site work',
    `<button class="btn pri" onclick="openRegModal()">${ic('plus')} New request</button>`,'Attendance')
  +note('info','Regularization reasons: <b>missing punch, biometric failure, incorrect shift, client site, work from home, official meeting, business travel, system error</b>. Approval flow: Employee → Reporting Manager → HR (where configured). Approved requests recalculate attendance while preserving the original record.')
  +'<div style="height:16px"></div>'
  +tableCard('My regularization requests',['Request','Date','Detail','Stage','Status','Action'],
    rows.map(r=>`<tr><td class="fw6 mono">${r.id}</td><td>${r.date}</td><td>${r.detail}</td><td class="muted">${r.stage}</td><td>${statusBadge(r.st==='Approved'?'Approved Late Login':r.st==='Rejected'?'Absent':'Regularization Pending')}</td>
      <td><button class="btn sm ghost" onclick="toast('Opening request ${r.id}')">View</button></td></tr>`).join(''));
};

VIEWS['ee-requests']=()=>pageHead('Late / Early / Shift Requests','Notify manager and HR in advance of planned deviations',
    `<button class="btn pri" onclick="openReqModal()">${ic('plus')} New request</button>`,'Attendance')
  +note('info','A <b>scheduled late login / early departure</b> requires prior notice to the Reporting Manager and HR and approval before the attendance event. Otherwise it is classified as <b>unscheduled</b> and counts toward occurrences. Repeated approved requests are tracked as <b>recurring scheduled</b> deviations.')
  +'<div style="height:16px"></div>'
  +tableCard('My requests',['Request','Type','Date','Detail','Status'],
    REQUESTS.map(r=>`<tr><td class="fw6 mono">${r.id}</td><td>${r.type}</td><td>${r.date}</td><td>${r.detail}</td><td>${statusBadge(r.st==='Approved'?'Approved Late Login':r.st==='Rejected'?'Unscheduled Late Login':'Regularization Pending')}</td></tr>`).join(''));

VIEWS['leave-balances']=()=>pageHead('Leave Balances','Accrued, used, pending and available by leave type','','Leave')
  +note('warn',`Comp-off hours-to-day ratio and expiry are ${phFlag('HR confirmation pending')} (FRS §28). Values shown are illustrative.`)
  +'<div style="height:16px"></div>'
  +`<div class="grid g-3">${LEAVE_BAL.map(b=>`<div class="card"><div class="card-b">
    <div class="hb" style="justify-content:space-between"><div class="hb">${bdg(b.cls,b.code)}<b>${b.t}</b></div><div class="k-val" style="font-size:24px">${b.avail}<span style="font-size:13px;color:var(--muted);font-weight:500"> ${b.unit}</span></div></div>
    <div style="margin:12px 0">${bar(b.cap?(b.avail/b.cap*100):50)}</div>
    <div class="dl" style="grid-template-columns:1fr auto;font-size:12.5px">
      <dt>Accrued</dt><dd>${b.accrued}</dd><dt>Used</dt><dd>${b.used}</dd><dt>Pending</dt><dd>${b.pending}</dd></div>
    <div class="divider" style="margin:12px 0"></div><div class="muted" style="font-size:12px">${b.note}</div>
  </div></div>`).join('')}</div>`;

VIEWS['apply-leave']=()=>({html:
  pageHead('Apply for Leave','The system validates eligibility, balance, notice and documents before submission','','Leave')
  +`<div class="row">
    <div style="flex:1.4">${card('Leave application',`
      <div class="form-row two">
        <div class="field"><label>Leave type <span class="req">*</span></label>
          <select id="alType" onchange="updateLeaveHints()">${LEAVE_TYPES.map(t=>`<option>${t.t}</option>`).join('')}</select></div>
        <div class="field"><label>Classification</label><select><option>Personal</option><option>Official</option></select></div>
      </div>
      <div class="form-row two">
        <div class="field"><label>From date <span class="req">*</span></label><input type="date" value="2025-08-18"></div>
        <div class="field"><label>To date <span class="req">*</span></label><input type="date" value="2025-08-26"><div class="hint">To Date = day before reporting back to work</div></div>
      </div>
      <div class="field" style="margin-bottom:14px"><label>Reason <span class="req">*</span></label><textarea placeholder="Provide a reason for the leave request"></textarea></div>
      <div class="field" style="margin-bottom:14px"><label>Supporting document <span id="docReq" class="muted"></span></label><div class="upload" onclick="toast('Uploads are inert in this prototype')">${ic('file')} Drag & drop or click to attach (inert)</div></div>
      <div class="modal-f" style="padding:0;border:none"><button class="btn" onclick="go('leave-history')">Save draft</button><button class="btn pri" onclick="toast('Application submitted for approval (visual only)')">Submit application</button></div>
    `)}</div>
    <div style="flex:1">
      ${card('Live validation',`<div id="valList">${valChecklist('Annual Leave')}</div>`,{sub:'FRS §17'})}
      <div style="height:16px"></div>
      ${card('Approval flow',`<div class="steps">
        <div class="step done"><div class="sc">${ic('check')}</div><div class="st">Employee</div><div class="ss">Submit</div></div>
        <div class="step active"><div class="sc">2</div><div class="st">Manager</div><div class="ss">Approve</div></div>
        <div class="step"><div class="sc">3</div><div class="st">HR</div><div class="ss">Confirm</div></div>
      </div>`)}
    </div>
  </div>`
});
function valChecklist(type){
  const cfg={
    'Annual Leave':[['Eligibility & probation','ok','Probation completed'],['Available balance','ok','5.5 of 30 days'],['Application notice','ok','30–45 days notice met'],['Segment count & 3-mo gap','warn','Segment 2 of 3 — gap OK'],['Combination restriction','ok','Not combined with other leave'],['Weekend / holiday treatment','ok','Calendar-day calculation']],
    'Sick Leave':[['Instance number & pay tier','ok','Instance 3 of 6'],['Medical certificate','warn','Required if ≥2 days or Monday'],['Manager notified before workday','ok','Acknowledged'],['Probation status','warn','Paid SL not available during probation']],
    'Hajj Leave':[['Once-in-employment rule','ok','Not previously taken'],['Evidence required','warn','Attach approval & evidence'],['Max 30 days · unpaid','ok','Within limit']],
  };
  const rows=(cfg[type]||cfg['Annual Leave']).map(r=>`<div class="lrow" style="padding:9px 0"><div class="li-ic ${r[1]==='ok'?'':''}" style="width:26px;height:26px;background:${r[1]==='ok'?'var(--g-bg)':'var(--a-bg)'};color:${r[1]==='ok'?'var(--g)':'var(--a)'}">${ic(r[1]==='ok'?'check':'alert')}</div><div><div class="li-t" style="font-size:12.5px">${r[0]}</div><div class="li-s">${r[2]}</div></div></div>`).join('');
  return rows;
}

VIEWS['al-plan']=()=>pageHead('Annual Leave Plan','Propose leave segments 30–45 days in advance for manager approval',
    `<button class="btn pri" onclick="openPlanModal()">${ic('plus')} Propose segment</button>`,'Leave')
  +note('info','Annual leave allows a <b>maximum of 3 segments</b> per employment year, each <b>≥ 7 calendar days</b>, with a <b>≥ 3-month gap</b> between segments. The manager may approve, reject or propose alternative dates.')
  +`<div style="height:16px"></div><div class="grid g-3" style="margin-bottom:16px">
    ${kpi({icon:'plan',acc:'b',val:'2 / 3',lbl:'Segments used this year'})}
    ${kpi({icon:'calendar',acc:'g',val:'14',lbl:'Days planned'})}
    ${kpi({icon:'wallet',acc:'p',val:'5.5',lbl:'Balance available'})}
  </div>`
  +tableCard('Proposed & confirmed segments',['Segment','Period','Days','Gap OK','Status'],
    [['1','02–06 Feb 2025','5','—','Approved'],['2','18–26 Aug 2025','9','Yes (6 mo)','Pending'],['3','Not planned','—','—','Available']]
    .map(s=>`<tr><td class="fw6">Segment ${s[0]}</td><td>${s[1]}</td><td class="num">${s[2]}</td><td>${s[3]}</td><td>${s[4]==='Approved'?bdg('s-g','Approved'):s[4]==='Pending'?bdg('s-a','Pending'):bdg('s-gray','Available')}</td></tr>`).join(''));

VIEWS['leave-history']=()=>pageHead('Leave History','All applications with extension, cancellation and recall actions','','Leave')
  +tableCard('My leave applications',['Ref','Type','Period','Days','Stage','Status','Actions'],
    LEAVE_APPS.map(a=>`<tr><td class="fw6 mono">${a.id}</td><td>${a.type}</td><td>${a.from}${a.to!=='—'?' → '+a.to:''}</td><td class="num">${a.days||'—'}</td><td class="muted">${a.stage}</td><td>${a.st==='Approved'?bdg('s-g','Approved'):a.st==='Pending'?bdg('s-a','Pending'):bdg('s-r','Rejected')}</td>
      <td><div class="hb">${a.st==='Approved'?`<button class="btn sm ghost" onclick="toast('Extension request (visual)')">Extend</button><button class="btn sm ghost" onclick="toast('Cancellation workflow (visual)')">Cancel</button>`:a.st==='Pending'?`<button class="btn sm ghost" onclick="toast('Withdrawn (visual)')">Withdraw</button>`:'—'}</div></td></tr>`).join(''),
    {actions:`<select class="btn sm" style="height:32px" onchange="toast('Filtered by '+this.value)"><option>All types</option>${LEAVE_TYPES.map(t=>`<option>${t.t}</option>`).join('')}</select>`})
  +'<div style="height:16px"></div>'
  +note('info','<b>Recall</b> restores full or partial leave days and may create an approved reimbursement claim. <b>Extension</b> requires immediate notification and a revised application — failure to notify becomes unauthorized absence.');

VIEWS['ot-compoff']=()=>pageHead('Overtime & Comp-Off','Additional work requests and compensatory-off balance',
    `<button class="btn pri" onclick="openOtModal()">${ic('plus')} Request overtime</button>`,'More')
  +note('warn',`Overtime rounding increment, special-allowance amount/formula and comp-off ratio/expiry are ${phFlag('HR confirmation pending')} (FRS §28).`)
  +`<div style="height:16px"></div><div class="grid g-3" style="margin-bottom:16px">
    ${kpi({icon:'clock2',acc:'g',val:'6.0',lbl:'Approved OT hours (month)'})}
    ${kpi({icon:'gift',acc:'p',val:'1',lbl:'Comp-off available'})}
    ${kpi({icon:'wallet',acc:'b',val:'AED —',lbl:'OT amount (pending calc)'})}
  </div>`
  +tableCard('Overtime & comp-off requests',['Date','Type','Hours','Category','Compensation','Status'],
    [['26 Jul 2025','Weekend work','5.0','Weekend +50%','Comp-off','Approved'],
     ['22 Jul 2025','Overtime','2.0','After 7 PM weekday','Special allowance','Pending'],
     ['15 Jul 2025','Overtime','1.5','Normal +25%','OT payment','Approved']]
    .map(r=>`<tr><td>${r[0]}</td><td>${r[1]}</td><td class="num">${r[2]}</td><td>${r[3]}</td><td>${r[4]}</td><td>${r[5]==='Approved'?bdg('s-g','Approved'):bdg('s-a','Pending')}</td></tr>`).join(''));

VIEWS['holidays']=()=>pageHead('Holiday Calendar','UAE private-sector public holidays by company and location','','More')
  +note('info','If unpaid leave is taken <b>immediately before and after</b> a public holiday, the holiday is converted to unpaid leave / loss of pay (FRS §16.1).')
  +'<div style="height:16px"></div>'
  +`<div class="row"><div style="flex:1.3">`
  +tableCard('2025 public holidays',['Date','Holiday','Type'],
    HOLIDAYS.map(h=>`<tr><td class="fw6">${h.d}</td><td>${h.n}</td><td>${bdg('s-p',h.type)}</td></tr>`).join(''))
  +`</div><div style="flex:1">`
  +card('Restricted festive holiday',`<p class="muted" style="margin-bottom:12px">1 paid day per calendar year for your own national/religious holiday not covered by UAE public holidays. Prior approval required.</p><button class="btn" onclick="openLeaveQuick('Restricted Festive Holiday')">${ic('plus')} Request festive day</button>`)
  +`</div></div>`;

/* ---------------- MANAGER ---------------- */
VIEWS['mgr-dash']=()=>({html:
  pageHead('Team Dashboard','Reporting to '+ROLES.manager.person+' · '+EMP.length+' members',
    `<button class="btn" onclick="go('team-attendance')">${ic('users')} Team attendance</button><button class="btn pri" onclick="go('approvals')">${ic('inbox')} Approvals (3)</button>`,'Team Space')
  +`<div class="grid g-6" style="margin-bottom:16px">
    ${kpi({icon:'usercheck',acc:'g',val:'4',lbl:'Present'})}
    ${kpi({icon:'wallet',acc:'b',val:'2',lbl:'On leave'})}
    ${kpi({icon:'alert',acc:'a',val:'2',lbl:'Late / early'})}
    ${kpi({icon:'x',acc:'r',val:'1',lbl:'Unauth. absent'})}
    ${kpi({icon:'clock',acc:'a',val:'1',lbl:'Missing punch'})}
    ${kpi({icon:'inbox',acc:'p',val:'3',lbl:'Pending approvals'})}
  </div>
  <div class="row">
    <div style="flex:1.6">${tableCard('Live team status',['Member','Shift in','Status','Late/Early','Action'],
      EMP.slice(0,6).map(e=>`<tr><td>${personCell(e.n,e.desig)}</td><td class="mono">${e.in}</td><td>${statusBadge(e.st)}</td><td class="num">${e.late?e.late+'m late':e.early?e.early+'m early':'—'}</td><td><button class="btn sm ghost" onclick="go('team-attendance')">View</button></td></tr>`).join(''))}
    </div>
    <div style="flex:1">${card('Employees nearing thresholds',
      OCCURRENCES.map(o=>`<div class="lrow"><div class="li-ic ${o.cls}" style="background:var(--${o.cls==='s-r'?'r':o.cls==='s-a'?'a':'gray'}-bg);color:var(--${o.cls==='s-r'?'r':o.cls==='s-a'?'a':'gray'})">${ic('shield')}</div><div><div class="li-t">${o.emp}</div><div class="li-s">${o.type}</div></div><div class="li-r"><b>${o.count}/${o.thr}</b></div></div>`).join(''),
      {sub:'Occurrence watch',actions:`<button class="btn sm ghost" onclick="go('occurrence-summary')">All</button>`})}
    </div>
  </div>
  <div style="height:16px"></div>
  ${card('Team leave conflicts (this month)',
    note('warn','<b>2 overlapping leave requests</b> detected on 18–22 Aug: Afzal Rahman (Annual) and Rohit Nair (Annual). Review before approving to maintain coverage.')+
    `<div style="height:12px"></div><button class="btn" onclick="go('team-leave-cal')">${ic('calendar')} Open team leave calendar</button>`,{sub:'Coverage'})}
  `
});

VIEWS['team-attendance']=()=>pageHead('Team Attendance','Real-time attendance and availability for your team',
    `<button class="btn" onclick="toast('Export inert')">${ic('download')} Export</button>`,'Team')
  +`<div class="filters">
    <div class="fld"><label>Date</label><input type="date" value="2025-07-29"></div>
    <div class="fld"><label>Status</label><select onchange="toast('Filtered')"><option>All statuses</option><option>Present</option><option>On leave</option><option>Late</option><option>Absent</option></select></div>
    <div class="fld"><label>&nbsp;</label><button class="btn">${ic('filter')} Apply</button></div>
  </div>`
  +tableCard('Team · 29 July 2025',['Member','Check-in','Check-out','Status','Late','Early','Action'],
    EMP.map(e=>`<tr><td>${personCell(e.n,e.id)}</td><td class="mono">${e.in}</td><td class="mono">${e.out}</td><td>${statusBadge(e.st)}</td><td class="num">${e.late||'—'}</td><td class="num">${e.early||'—'}</td><td><button class="btn sm ghost" onclick="toast('Opening '+'${e.n}')">Detail</button></td></tr>`).join(''));

VIEWS['team-availability']=()=>pageHead('Team Availability','Who is available, on leave or off today','','Team')
  +`<div class="grid g-3">
    ${card('Available ('+EMP.filter(e=>e.st==='Present'||e.st==='Late Login'||e.st==='Work from Home'||e.st==='Unscheduled Late Login').length+')',EMP.filter(e=>['Present','Late Login','Work from Home','Unscheduled Late Login'].includes(e.st)).map(e=>`<div class="lrow">${personCell(e.n,e.desig)}<div class="li-r">${statusBadge(e.st)}</div></div>`).join(''))}
    ${card('On leave ('+EMP.filter(e=>e.st.includes('Leave')).length+')',EMP.filter(e=>e.st.includes('Leave')).map(e=>`<div class="lrow">${personCell(e.n,e.desig)}<div class="li-r">${statusBadge(e.st)}</div></div>`).join('')||'<div class="empty">None</div>')}
    ${card('Absent / issue ('+EMP.filter(e=>e.st.includes('Unauthorized')).length+')',EMP.filter(e=>e.st.includes('Unauthorized')).map(e=>`<div class="lrow">${personCell(e.n,e.desig)}<div class="li-r">${statusBadge(e.st)}</div></div>`).join('')||'<div class="empty">None</div>')}
  </div>`;

VIEWS['team-leave-cal']=()=>{
  const tagFn=(d,dow)=>{if(dow===0||dow===6)return[];const m={14:[{cls:'s-b',txt:'Rohit — AL'}],15:[{cls:'s-b',txt:'Rohit — AL'}],18:[{cls:'s-b',txt:'Afzal — AL'},{cls:'s-b',txt:'Rohit — AL'}],19:[{cls:'s-b',txt:'Afzal — AL'}],28:[{cls:'s-b',txt:'Sara — SL'}]};return m[d]||[]};
  return pageHead('Team Leave Calendar','Approved and pending leave with conflict detection','','Leave')
  +note('warn','Overlap on <b>18 Aug</b>: 2 members on annual leave simultaneously. Verify coverage before approving.')
  +'<div style="height:16px"></div>'+calGrid(tagFn)+calLegend([{c:'var(--b)',l:'Leave'},{c:'var(--gray)',l:'Weekly Off'}]);
};

VIEWS['al-plans-review']=()=>pageHead('Annual Leave Plans','Review proposed segments; approve or propose alternative dates','','Leave')
  +tableCard('Submitted plans',['Member','Segment','Proposed period','Days','Conflict','Action'],
    [['Afzal Rahman','2 of 3','18–26 Aug 2025','9','Overlap w/ Rohit','p'],
     ['Sara Menon','1 of 3','06–13 Oct 2025','8','None','p'],
     ['Rohit Nair','1 of 3','14–22 Jul 2025','9','—','a']]
    .map(r=>`<tr><td>${personCell(r[0])}</td><td>${r[1]}</td><td>${r[2]}</td><td class="num">${r[3]}</td><td>${r[4]==='None'||r[4]==='—'?bdg('s-g','Clear'):bdg('s-a',r[4])}</td>
      <td>${r[5]==='a'?bdg('s-g','Approved'):`<div class="hb"><button class="btn sm ok" onclick="toast('Segment approved (visual)')">Approve</button><button class="btn sm" onclick="openAltModal('${r[0]}')">Alternative</button></div>`}</td></tr>`).join(''));

VIEWS['approvals']=()=>{
  const items=[
    {id:'LV-2041',emp:'Afzal Rahman',kind:'Annual Leave',detail:'18–26 Aug · 9 days',flag:'Conflict w/ Rohit'},
    {id:'LV-2044',emp:'Sara Menon',kind:'Sick Leave',detail:'28–29 Jul · 2 days',flag:'Medical cert required'},
    {id:'RG-981',emp:'Afzal Rahman',kind:'Regularization',detail:'Missing check-out 25 Jul',flag:''},
    {id:'OT-118',emp:'Rohit Nair',kind:'Overtime',detail:'Weekend work · 5.0 h',flag:''},
    {id:'RG-985',emp:'Aisha Khan',kind:'Late Login (Scheduled)',detail:'Clinic — 30 Jul',flag:''},
  ];
  return pageHead('Approvals','Unified inbox: leave, regularization, late/early, overtime and schedule changes',
    `<button class="btn ok sm" onclick="toast('Bulk approve (visual)')">${ic('check')} Approve selected</button>`,'Actions')
  +tabs([{k:'all',l:'All (5)'},{k:'leave',l:'Leave (2)'},{k:'att',l:'Attendance (2)'},{k:'ot',l:'Overtime (1)'}],'all','filterApprovals')
  +`<div class="stack">${items.map(it=>`<div class="card"><div class="card-b" style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
    <input type="checkbox">${personCell(it.emp,it.id)}
    <div style="flex:1;min-width:140px"><div class="fw6">${it.kind}</div><div class="muted" style="font-size:12.5px">${it.detail}</div></div>
    ${it.flag?bdg('s-a',it.flag):''}
    <div class="hb"><button class="btn sm ok" onclick="openApprove('${it.id}','${it.emp}','${it.kind}','approve')">${ic('check')} Approve</button>
    <button class="btn sm danger" onclick="openApprove('${it.id}','${it.emp}','${it.kind}','reject')">${ic('x')} Reject</button></div>
  </div></div>`).join('')}</div>`;
};

VIEWS['pattern-review']=()=>pageHead('Pattern Review','Attendance patterns flagged for review (HR decides if they count as an occurrence)','','Actions')
  +note('info','Patterns detected: absence adjacent to weekends/holidays/leave, repeated absence on a preferred weekday, or repeated sick leave around holidays. The system flags — it does not auto-penalise (FRS §8.5).')
  +'<div style="height:16px"></div>'
  +tableCard('Flagged patterns',['Member','Pattern','Instances','Window','Recommendation','Action'],
    [['Aisha Khan','Monday sick leave','3','12 mo','Refer to HR','s-a'],
     ['Afzal Rahman','Absence before weekend','2','12 mo','Under watch','s-gray'],
     ['Deepak R.','Sick leave adjacent to holiday','2','12 mo','Refer to HR','s-a']]
    .map(r=>`<tr><td>${personCell(r[0])}</td><td>${r[1]}</td><td class="num">${r[2]}</td><td>${r[3]}</td><td>${bdg(r[5],r[4])}</td><td><button class="btn sm" onclick="toast('Referred to HR (visual)')">Refer to HR</button></td></tr>`).join(''));

VIEWS['occurrence-summary']=()=>pageHead('Team Occurrence Summary','Occurrence counters against configured thresholds (rolling 12 months)','','Actions')
  +tableCard('Occurrence counters',['Member','Deviation type','Count','Threshold','Progress','Status'],
    OCCURRENCES.concat([{emp:'Sara Menon',id:'',type:'Unscheduled Early Departure',count:1,thr:3,cls:'s-gray'},{emp:'Deepak R.',id:'',type:'Recurring Scheduled Late Login',count:4,thr:7,cls:'s-gray'}])
    .map(o=>`<tr><td>${personCell(o.emp)}</td><td>${o.type}</td><td class="num fw6">${o.count}</td><td class="num">${o.thr}</td><td style="width:140px">${bar(o.count/o.thr*100,o.count/o.thr>=1?'var(--r)':o.count/o.thr>=0.7?'var(--a)':'var(--g)')}</td><td>${o.count>=o.thr?bdg('s-r','Occurrence'):o.count/o.thr>=0.7?bdg('s-a','Near threshold'):bdg('s-g','OK')}</td></tr>`).join(''))
  +'<div style="height:16px"></div>'
  +tableCard('Conversion thresholds (reference · FRS §10.1)',['Deviation type','Instances = 1 occurrence'],
    [['Pattern Absence','5'],['Unscheduled Late Login','6'],['Unscheduled Early Departure','3'],['Recurring Scheduled Absence','5'],['Recurring Scheduled Late Login','7'],['Recurring Scheduled Early Departure','6']]
    .map(r=>`<tr><td>${r[0]}</td><td class="num">${r[1]}</td></tr>`).join(''));


/* ---------------- HR ---------------- */
VIEWS['hr-att-dash']=()=>({html:
  pageHead('HR — Attendance Dashboard','Organisation-wide daily attendance, deviations and finalization status',
    `<button class="btn" onclick="go('reports')">${ic('chart')} Reports</button><button class="btn pri" onclick="go('att-processing')">${ic('refresh')} Run processing</button>`,'HR Space')
  +`<div class="grid g-6" style="margin-bottom:16px">
    ${kpi({icon:'usercheck',acc:'g',val:'142',lbl:'Present today'})}
    ${kpi({icon:'x',acc:'r',val:'3',lbl:'Unauth. absence'})}
    ${kpi({icon:'alert',acc:'a',val:'11',lbl:'Late logins'})}
    ${kpi({icon:'clock',acc:'a',val:'6',lbl:'Missing punches'})}
    ${kpi({icon:'doc',acc:'b',val:'2',lbl:'Pending med. verify'})}
    ${kpi({icon:'shield',acc:'p',val:'4',lbl:'Occurrence alerts'})}
  </div>
  <div class="row">
    <div style="flex:1.4">${card('Today’s attendance summary',
      `<div class="grid g-4" style="gap:12px;margin-bottom:14px">
        <div><div class="k-val" style="font-size:22px">160</div><div class="muted">Scheduled</div></div>
        <div><div class="k-val" style="font-size:22px;color:var(--g)">142</div><div class="muted">Present</div></div>
        <div><div class="k-val" style="font-size:22px;color:var(--b)">12</div><div class="muted">On leave</div></div>
        <div><div class="k-val" style="font-size:22px;color:var(--r)">3</div><div class="muted">Unauth.</div></div>
      </div>${bar(89,'var(--g)')}<div class="muted" style="font-size:12px;margin-top:6px">88.7% attendance rate</div>`)}
    </div>
    <div style="flex:1">${card('Attendance finalization',
      `<div class="mini-stat"><span>June 2025</span>${bdg('s-g','Locked')}</div>
       <div class="mini-stat" style="margin-top:10px"><span>July 2025</span>${bdg('s-a','Open — 2 days left')}</div>${bar(80,'var(--a)')}
       <div class="divider"></div><button class="btn" onclick="go('finalization')">${ic('lock')} Go to finalize & lock</button>`,{sub:'Payroll readiness'})}
    </div>
  </div>
  <div class="row" style="margin-top:16px">
    <div style="flex:1">${card('Attention required',
      `<div class="lrow"><div class="li-ic" style="background:var(--r-bg);color:var(--r)">${ic('x')}</div><div><div class="li-t">3 unauthorized absences</div><div class="li-s">Create LOP + disciplinary review</div></div><div class="li-r"><button class="btn sm" onclick="go('exceptions')">Resolve</button></div></div>
       <div class="lrow"><div class="li-ic" style="background:var(--b-bg);color:var(--b)">${ic('doc')}</div><div><div class="li-t">2 medical certificates pending</div><div class="li-s">Sick leave document verification</div></div><div class="li-r"><button class="btn sm" onclick="go('doc-verify')">Verify</button></div></div>
       <div class="lrow"><div class="li-ic" style="background:var(--a-bg);color:var(--a)">${ic('wallet')}</div><div><div class="li-t">7 employees — AL expiring</div><div class="li-s">Carry-forward expires in 90 days</div></div><div class="li-r"><button class="btn sm" onclick="go('carry-forward')">Review</button></div></div>`)}
    </div>
    <div style="flex:1">${card('Overtime cost (July, so far)',
      `<div class="k-val">AED 4,280<span style="font-size:13px;color:var(--muted);font-weight:500"> · 118 h</span></div>
       <div class="divider"></div>
       <div class="mini-stat"><span>Normal (+25%)</span><b>62 h</b></div>
       <div class="mini-stat"><span>Night (+50%)</span><b>21 h</b></div>
       <div class="mini-stat"><span>Weekend</span><b>35 h</b></div>
       <div class="note warn" style="margin-top:10px">${ic('alert')}<div>Overtime rate/rounding increment is pending HR confirmation (FRS §28).</div></div>`)}
    </div>
  </div>`
});

VIEWS['hr-leave-dash']=()=>({html:
  pageHead('HR — Leave Dashboard','Balances, liability, utilization and leave cases','','HR Space')
  +`<div class="grid g-4" style="margin-bottom:16px">
    ${kpi({icon:'wallet',acc:'b',val:'1,240',lbl:'AL liability (days)'})}
    ${kpi({icon:'clock2',acc:'a',val:'38',lbl:'Expiring AL (90 days)'})}
    ${kpi({icon:'doc',acc:'p',val:'6',lbl:'Sick — missing cert'})}
    ${kpi({icon:'baby',acc:'g',val:'2',lbl:'Maternity cases'})}
  </div>
  <div class="row">
    <div style="flex:1.3">${tableCard('Leave utilization by type (org)',['Leave type','Entitled','Used','Pending','Utilization'],
      [['Annual Leave','4,800','3,120','210','65%'],['Sick Leave','—','412','12','—'],['Compassionate','—','24','2','—'],['Maternity','—','120','0','—'],['Unpaid / LOP','—','63','5','—']]
      .map(r=>`<tr><td class="fw6">${r[0]}</td><td class="num">${r[1]}</td><td class="num">${r[2]}</td><td class="num">${r[3]}</td><td style="width:120px">${r[4]==='—'?'—':bar(parseInt(r[4]))}</td></tr>`).join(''))}
    </div>
    <div style="flex:1">${card('Leave cases queue',
      `<div class="lrow"><div class="li-ic" style="background:var(--b-bg);color:var(--b)">${ic('doc')}</div><div><div class="li-t">Document verification</div><div class="li-s">2 pending</div></div><div class="li-r"><button class="btn sm" onclick="go('doc-verify')">Open</button></div></div>
       <div class="lrow"><div class="li-ic" style="background:var(--p-bg);color:var(--p)">${ic('gift')}</div><div><div class="li-t">Encashment requests</div><div class="li-s">3 pending</div></div><div class="li-r"><button class="btn sm" onclick="go('encashment')">Open</button></div></div>
       <div class="lrow"><div class="li-ic" style="background:var(--a-bg);color:var(--a)">${ic('history')}</div><div><div class="li-t">Carry-forward approvals</div><div class="li-s">7 pending</div></div><div class="li-r"><button class="btn sm" onclick="go('carry-forward')">Open</button></div></div>
       <div class="lrow"><div class="li-ic" style="background:var(--g-bg);color:var(--g)">${ic('baby')}</div><div><div class="li-t">Maternity / parental</div><div class="li-s">2 active</div></div><div class="li-r"><button class="btn sm" onclick="go('maternity')">Open</button></div></div>`)}
    </div>
  </div>`
});

VIEWS['att-processing']=()=>{
  const steps=['Identify employee, company, location & policy','Identify shift & time zone','Check weekly off & public holiday','Retrieve biometric/web/mobile/manual punches','Detect duplicates & invalid punches','Determine first check-in / last check-out','Calculate gross presence hours','Deduct breaks → net working hours','Apply grace → late & early minutes','Check approved leave / on-duty / WFH / permission','Determine status & unauthorized absence','Calculate approved overtime & comp-off','Evaluate deviations & occurrence counters','Calculate payroll impact','Store breakdown & audit history'];
  return pageHead('Attendance Processing Engine','15-step calculation pipeline · preserves raw records',
    `<button class="btn" onclick="toast('Dry run (visual)')">Dry run</button><button class="btn pri" onclick="toast('Processing 160 employees… (visual)')">${ic('refresh')} Run for today</button>`,'Attendance Ops')
  +`<div class="row"><div style="flex:1.1">${card('Pipeline (FRS §7)',
    `<ol style="list-style:none;counter-reset:s">${steps.map((s,i)=>`<li style="display:flex;gap:12px;padding:8px 0;border-bottom:1px solid var(--line-2)"><span style="width:24px;height:24px;border-radius:50%;background:${i<11?'var(--g-bg)':'var(--brand-050)'};color:${i<11?'var(--g)':'var(--brand)'};display:grid;place-items:center;font-size:11px;font-weight:700;flex:none">${i<11?'✓':i+1}</span><span style="font-size:13px">${s}</span></li>`).join('')}</ol>`)}
    </div><div style="flex:1">
    ${card('Last run summary',`<div class="grid g-2" style="gap:12px">
      <div><div class="k-val" style="font-size:22px">160</div><div class="muted">Processed</div></div>
      <div><div class="k-val" style="font-size:22px;color:var(--a)">6</div><div class="muted">Exceptions</div></div>
      <div><div class="k-val" style="font-size:22px;color:var(--r)">2</div><div class="muted">Failed records</div></div>
      <div><div class="k-val" style="font-size:22px;color:var(--g)">152</div><div class="muted">Clean</div></div>
    </div><div class="divider"></div><button class="btn" onclick="go('exceptions')">${ic('alert')} Review 6 exceptions</button>`,{sub:'29 Jul 2025 · 06:00'})}
    <div style="height:16px"></div>
    ${note('info','Failed biometric records support <b>reprocessing</b>. Every modification preserves the original transaction and writes to the audit log.')}
    </div></div>`;
};

VIEWS['exceptions']=()=>pageHead('Attendance Exceptions','Missing punches, duplicates, invalid records and unauthorized absences',
    `<button class="btn" onclick="toast('Reprocess (visual)')">${ic('refresh')} Reprocess failed</button>`,'Attendance Ops')
  +tabs([{k:'all',l:'All (6)'},{k:'miss',l:'Missing punch (3)'},{k:'unauth',l:'Unauthorized (2)'},{k:'dup',l:'Duplicate (1)'}],'all','filterExceptions')
  +tableCard('',['Member','Date','Exception','Detail','Action'],
    [['Afzal Rahman','25 Jul','Missing Check-Out','Last punch 09:04','fix'],
     ['James Peter','24 Jul','Missing Check-In','Biometric failure','fix'],
     ['Layla Hassan','29 Jul','Unauthorized Absence','No punch, no approval','case'],
     ['Deepak R.','23 Jul','Duplicate punch','2 check-ins within 30s','fix'],
     ['Aisha Khan','22 Jul','Invalid record','Punch before shift start','fix'],
     ['Sara Menon','28 Jul','Missing Check-Out','Client site','fix']]
    .map(r=>`<tr><td>${personCell(r[0])}</td><td>${r[1]}</td><td>${statusBadge(r[2]==='Duplicate punch'||r[2]==='Invalid record'?'Attendance Pending':r[2])}</td><td class="muted">${r[3]}</td>
      <td>${r[4]==='case'?`<button class="btn sm danger" onclick="go('discipline')">Create case</button>`:`<button class="btn sm" onclick="openManualModal('${r[0]}')">Manual correct</button>`}</td></tr>`).join(''))
  +'<div style="height:16px"></div>'+note('warn','Manual HR attendance requires a <b>mandatory reason and supporting attachment</b>, and never overwrites the raw record (FRS §5).');

VIEWS['occurrence-mgmt']=()=>pageHead('Occurrence Management','Create, waive and monitor occurrences against thresholds','','Attendance Ops')
  +tableCard('Occurrences (rolling 12 months)',['Member','Type','Count','Threshold','Recommended action','Manage'],
    OCCURRENCES.map(o=>`<tr><td>${personCell(o.emp,o.id)}</td><td>${o.type}</td><td class="num fw6">${o.count}</td><td class="num">${o.thr}</td><td>${bdg(o.cls,o.action)}</td>
      <td><div class="hb"><button class="btn sm" onclick="toast('Occurrence created (visual)')">Create</button><button class="btn sm ghost" onclick="openWaiveModal('${o.emp}')">Waive</button></div></td></tr>`).join(''))
  +'<div style="height:16px"></div>'
  +`<div class="row"><div style="flex:1">`
  +tableCard('General deviation thresholds',['Occurrences (12 mo)','Recommended action'],
    [['2','Verbal Warning'],['3','First Written Warning'],['6','Second Written Warning'],['8','Final Written Warning'],['10','Termination Review']].map(r=>`<tr><td class="num">${r[0]}</td><td>${r[1]}</td></tr>`).join(''))
  +`</div><div style="flex:1">`
  +tableCard('Unauthorized absence thresholds',['Occurrences','Recommended action'],
    [['1','First Written Warning'],['2','Second Written Warning'],['3','Final Written Warning'],['4','Termination Review']].map(r=>`<tr><td class="num">${r[0]}</td><td>${r[1]}</td></tr>`).join(''))
  +`</div></div>`
  +'<div style="height:16px"></div>'+note('warn',`Occurrence counter reset rule and warning validity window are ${phFlag('HR confirmation pending')} (FRS §28).`);

VIEWS['discipline']=()=>pageHead('Disciplinary Review Cases','Recommendations only — HR confirmation is mandatory, no automated termination','','Attendance Ops')
  +note('warn','The system <b>never automatically terminates</b> an employee. Each case captures manager comments, HR decision, warning reference, waiver option and full audit history (FRS §10).')
  +'<div style="height:16px"></div>'
  +tableCard('Review cases',['Case','Member','Trigger','Recommended','Manager note','HR decision'],
    [['DC-042','Layla Hassan','1 unauthorized absence','First Written Warning','Confirmed absence','pending'],
     ['DC-039','Aisha Khan','5 unscheduled late logins','Verbal Warning','Traffic pattern','pending'],
     ['DC-031','Deepak R.','Pattern absence (probation)','Verbal Warning','Under probation','done']]
    .map(r=>`<tr><td class="fw6 mono">${r[0]}</td><td>${personCell(r[1])}</td><td>${r[2]}</td><td>${bdg('s-a',r[3])}</td><td class="muted">${r[4]}</td>
      <td>${r[5]==='done'?bdg('s-g','Warning issued'):`<div class="hb"><button class="btn sm ok" onclick="openDecisionModal('${r[0]}','confirm')">Confirm</button><button class="btn sm ghost" onclick="openDecisionModal('${r[0]}','waive')">Waive</button></div>`}</td></tr>`).join(''));

VIEWS['finalization']=()=>pageHead('Finalize & Lock Attendance','Lock the monthly period before payroll export',
    `<button class="btn danger" onclick="openReopenModal()">${ic('lockOpen')} Reopen period</button><button class="btn pri" onclick="openLockModal()">${ic('lock')} Lock July 2025</button>`,'Attendance Ops')
  +`<div class="grid g-4" style="margin-bottom:16px">
    ${kpi({icon:'check',acc:'g',val:'152',lbl:'Finalized records'})}
    ${kpi({icon:'alert',acc:'a',val:'6',lbl:'Open exceptions'})}
    ${kpi({icon:'doc',acc:'b',val:'2',lbl:'Pending verification'})}
    ${kpi({icon:'lock',acc:'p',val:'2',lbl:'Days to cut-off'})}
  </div>`
  +note('warn','Monthly attendance must be locked before payroll export. Any post-lock change requires <b>HR authorization, a reopening reason, audit history</b> and current/next-cycle adjustment (FRS §20).')
  +'<div style="height:16px"></div>'
  +tableCard('Period readiness',['Period','Records','Exceptions','Status','Action'],
    [['June 2025','160','0','Locked','locked'],['July 2025','158','6','Open','open'],['August 2025','—','—','Not started','na']]
    .map(r=>`<tr><td class="fw6">${r[0]}</td><td class="num">${r[1]}</td><td class="num">${r[2]}</td><td>${r[3]==='Locked'?bdg('s-g','Locked'):r[3]==='Open'?bdg('s-a','Open'):bdg('s-gray','Not started')}</td>
      <td>${r[4]==='open'?`<button class="btn sm pri" onclick="openLockModal()">Lock</button>`:r[4]==='locked'?`<button class="btn sm ghost" onclick="go('payroll-export')">Export</button>`:'—'}</td></tr>`).join(''));

VIEWS['doc-verify']=()=>pageHead('Medical Document Verification','Verify sick-leave certificates and convert unsupported leave','','Leave Ops')
  +note('info','A valid medical certificate is mandatory for ≥2 consecutive days, Monday sick leave, instances after the first six, and sick leave adjacent to a public holiday. Missing/invalid documents are converted to unpaid leave (FRS §14).')
  +'<div style="height:16px"></div>'
  +tableCard('Verification queue',['Member','Instance','Period','Days','Requirement','Document','Action'],
    [['Sara Menon','1st','28–29 Jul','2','Cert (≥2 days)','Uploaded','verify'],
     ['James Peter','2nd','24 Jul','1','Prescription','Uploaded','verify'],
     ['Aisha Khan','7th','21 Jul','1','Cert (>6 instances)','Missing','convert']]
    .map(r=>`<tr><td>${personCell(r[0])}</td><td>${r[1]}</td><td>${r[2]}</td><td class="num">${r[3]}</td><td>${r[4]}</td><td>${r[5]==='Missing'?bdg('s-r','Missing'):bdg('s-g','Uploaded')}</td>
      <td>${r[6]==='convert'?`<button class="btn sm danger" onclick="toast('Converted to unpaid (visual)')">Convert to unpaid</button>`:`<div class="hb"><button class="btn sm ok" onclick="toast('Verified (visual)')">Verify</button><button class="btn sm ghost" onclick="toast('Rejected')">Reject</button></div>`}</td></tr>`).join(''))
  +'<div style="height:16px"></div>'+note('warn','Access to medical information is restricted and audited (FRS §25).');

VIEWS['balance-adj']=()=>pageHead('Leave Balance Adjustment','Manual adjustments with mandatory reason and audit trail',
    `<button class="btn pri" onclick="openAdjModal()">${ic('edit')} New adjustment</button>`,'Leave Ops')
  +note('warn','Every manual override requires a reason and audit record (FRS §27, rule 16).')
  +'<div style="height:16px"></div>'
  +tableCard('Recent adjustments',['Member','Leave type','Change','Reason','By','Date'],
    [['Rohit Nair','Annual Leave','+2.0','Recall reimbursement','Mariam Y.','14 Jul'],
     ['Afzal Rahman','Comp-Off','+1.0','Weekend work credit','Mariam Y.','12 Jul'],
     ['Fatima Ali','Annual Leave','−1.5','Correction of accrual','Mariam Y.','02 Jul']]
    .map(r=>`<tr><td>${personCell(r[0])}</td><td>${r[1]}</td><td class="num fw6" style="color:${r[2][0]==='+'?'var(--g)':'var(--r)'}">${r[2]}</td><td class="muted">${r[3]}</td><td>${r[4]}</td><td>${r[5]}</td></tr>`).join(''));

VIEWS['carry-forward']=()=>pageHead('Carry Forward','Approve carry-forward and monitor 3-month expiry','','Leave Ops')
  +note('warn',`Carry-forward workflow (manager only vs manager + HR) and exact three-month expiry date logic are ${phFlag('HR confirmation pending')} (FRS §28).`)
  +'<div style="height:16px"></div>'
  +tableCard('Carry-forward requests',['Member','Carry days','Entitlement year','Expires','Status','Action'],
    [['Afzal Rahman','2.0','2024–25','31 Mar 2026','Pending','p'],
     ['Sara Menon','3.5','2024–25','31 Mar 2026','Approved','a'],
     ['Deepak R.','1.0','2024–25','28 Feb 2026','Pending','p']]
    .map(r=>`<tr><td>${personCell(r[0])}</td><td class="num">${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td><td>${r[4]==='Approved'?bdg('s-g','Approved'):bdg('s-a','Pending')}</td>
      <td>${r[5]==='p'?`<button class="btn sm ok" onclick="toast('Carry-forward approved (visual)')">Approve</button>`:'—'}</td></tr>`).join(''));

VIEWS['encashment']=()=>pageHead('Leave Encashment','Operational-reason encashment · Manager and HR approval','','Leave Ops')
  +note('warn',`Encashment formula (gross / basic / approved salary component) is ${phFlag('HR confirmation pending')}. Payment within 45 days after approval.`)
  +'<div style="height:16px"></div>'
  +tableCard('Encashment requests',['Member','Days','Reason','Manager','HR','Payroll'],
    [['Rohit Nair','5','Operational — no leave possible','Approved','Pending','—'],
     ['Fatima Ali','3','Operational','Approved','Approved','Queued'],
     ['Layla Hassan','4','Operational','Pending','—','—']]
    .map(r=>`<tr><td>${personCell(r[0])}</td><td class="num">${r[1]}</td><td class="muted">${r[2]}</td><td>${r[3]==='Approved'?bdg('s-g','✓'):bdg('s-a','Pending')}</td><td>${r[4]==='Approved'?bdg('s-g','✓'):r[4]==='Pending'?bdg('s-a','Pending'):'—'}</td><td>${r[5]!=='—'?bdg('s-b',r[5]):'—'}</td></tr>`).join(''));

VIEWS['maternity']=()=>pageHead('Maternity & Parental Leave','Track entitlement, pay tiers and supporting cases','','Leave Ops')
  +`<div class="row"><div style="flex:1">`
  +tableCard('Active maternity cases',['Member','Type','Full-pay','Half-pay','Unpaid','Status'],
    [['Fatima Ali','Standard maternity','45','15','0','On leave'],['Aisha Khan','Newborn illness','30','0','30','Approved']]
    .map(r=>`<tr><td>${personCell(r[0])}</td><td>${r[1]}</td><td class="num">${r[2]}</td><td class="num">${r[3]}</td><td class="num">${r[4]}</td><td>${bdg('s-b',r[5])}</td></tr>`).join(''))
  +`</div><div style="flex:1">`
  +tableCard('Parental leave',['Member','Entitlement','Window','Document','Status'],
    [['James Peter','5 working days','Birth → 6 months','Uploaded','Approved']]
    .map(r=>`<tr><td>${personCell(r[0])}</td><td>${r[1]}</td><td>${r[2]}</td><td>${bdg('s-g',r[3])}</td><td>${bdg('s-g',r[4])}</td></tr>`).join(''))
  +`</div></div>`
  +'<div style="height:16px"></div>'+note('info','Standard maternity: 45 full-pay + 15 half-pay (60 total). Nursing break of 2 hours/working day. Annual-leave combination not allowed (FRS §15.2).');

VIEWS['hr-ot']=()=>pageHead('Overtime & Comp-Off (HR)','Approve, calculate and track overtime and compensatory off','','Payroll & Output')
  +tableCard('Overtime calculation rules (FRS §19)',['Category','Calculation rule'],
    [['Normal overtime','Basic hourly wage + at least 25%'],['10:00 PM–4:00 AM','Basic hourly wage + at least 50% (shift-worker exclusion configurable)'],['Weekend work','Alternative day off, or normal day wage + at least 50% of basic wage'],['Compensation method','OT payment, special allowance, comp-off, alternative day off, or none with reason']]
    .map(r=>`<tr><td class="fw6">${r[0]}</td><td>${r[1]}</td></tr>`).join(''))
  +'<div style="height:16px"></div>'
  +tableCard('Overtime records (July 2025)',['Member','Date','Hours','Category','Method','Approved by'],
    [['Rohit Nair','26 Jul','5.0','Weekend +50%','Comp-off','N. Kurup'],['Deepak R.','24 Jul','2.0','Night +50%','OT payment','N. Kurup'],['Afzal Rahman','22 Jul','2.0','After 7 PM','Special allowance','N. Kurup']]
    .map(r=>`<tr><td>${personCell(r[0])}</td><td>${r[1]}</td><td class="num">${r[2]}</td><td>${r[3]}</td><td>${r[4]}</td><td>${r[5]}</td></tr>`).join(''))
  +'<div style="height:16px"></div>'+note('warn','Unapproved additional time must <b>not</b> automatically become payable overtime. Eligibility applies only to configured employee categories.');

VIEWS['payroll-export']=()=>pageHead('Payroll Export','Payroll-ready attendance, leave, LOP, overtime and encashment output',
    `<button class="btn" onclick="toast('CSV export inert')">${ic('download')} CSV</button><button class="btn pri" onclick="openLockModal()">${ic('lock')} Lock & export</button>`,'Payroll & Output')
  +note('info','July 2025 must be locked before export. Fields below map to the payroll attendance output entity (FRS §20).')
  +'<div style="height:16px"></div>'
  +tableCard('Payroll output preview — July 2025',['Member','Sched.','Present','Paid','LOP','OT h','Comp-off','Encash','Payable'],
    [['Afzal Rahman','22','20','21.5','0.5','2.0','1','0','21.5'],
     ['Sara Menon','22','20','22','0','0','0','0','22'],
     ['Rohit Nair','22','13','22','0','5.0','0','5','22'],
     ['Layla Hassan','22','18','19','3','0','0','0','19']]
    .map(r=>`<tr><td>${personCell(r[0])}</td><td class="num">${r[1]}</td><td class="num">${r[2]}</td><td class="num">${r[3]}</td><td class="num" style="color:${r[4]!=='0'?'var(--r)':''}">${r[4]}</td><td class="num">${r[5]}</td><td class="num">${r[6]}</td><td class="num">${r[7]}</td><td class="num fw6">${r[8]}</td></tr>`).join(''))
  +'<div style="height:16px"></div>'+note('info','This is a link-out boundary to the <b>Payroll Management</b> module — computed values are handed off, not re-implemented here.');

VIEWS['reports']=()=>{
  const att=['Daily & monthly attendance','Scheduled / unscheduled late login','Scheduled / unscheduled early departure','Unauthorized & pattern absence','Recurring scheduled absence','Missing punches & regularization','Working hours, breaks & overtime','Weekend & public-holiday work','Occurrence & disciplinary threshold','Probation attendance','Attendance KPI report'];
  const lv=['Annual leave balance / accrual / plan','Segments, carry forward, expiry & encashment','Sick-leave instances & pay tiers','Missing certificates','Maternity / parental / compassionate','Hajj history & study eligibility','Restricted holiday','Unpaid leave & loss of pay','Cancellation, extension & recall','Leave liability & team availability'];
  return pageHead('Reports & Analytics','Filter, save views, drill down and export (Excel / CSV / PDF)',
    `<button class="btn" onclick="openScheduleModal()">${ic('clock')} Schedule delivery</button>`,'Payroll & Output')
  +`<div class="filters">
    <div class="fld"><label>Company</label><select><option>GSIT · Dubai</option><option>All</option></select></div>
    <div class="fld"><label>Period</label><input type="date" value="2025-07-01"></div>
    <div class="fld"><label>to</label><input type="date" value="2025-07-31"></div>
    <div class="fld"><label>Department</label><select><option>All</option><option>Software Dev</option></select></div>
    <div class="fld"><label>&nbsp;</label><button class="btn">${ic('filter')} Apply</button></div>
  </div>`
  +`<div class="row"><div style="flex:1">${card('Attendance reports',att.map(r=>`<div class="lrow" style="padding:10px 0"><div class="li-ic" style="width:30px;height:30px;background:var(--brand-050);color:var(--brand)">${ic('chart')}</div><div class="li-t" style="font-size:13px">${r}</div><div class="li-r"><button class="btn sm ghost" onclick="toast('Generating: ${r}')">Run</button></div></div>`).join(''),{sub:'FRS §22.1'})}</div>
  <div style="flex:1">${card('Leave reports',lv.map(r=>`<div class="lrow" style="padding:10px 0"><div class="li-ic" style="width:30px;height:30px;background:var(--p-bg);color:var(--p)">${ic('pie')}</div><div class="li-t" style="font-size:13px">${r}</div><div class="li-r"><button class="btn sm ghost" onclick="toast('Generating: ${r}')">Run</button></div></div>`).join(''),{sub:'FRS §22.2'})}</div></div>`;
};

VIEWS['audit']=()=>pageHead('Audit Logs','Immutable trail of edits, verifications, locks and policy changes','','Payroll & Output')
  +`<div class="filters">
    <div class="fld"><label>Action</label><select><option>All actions</option><option>Attendance edit</option><option>Balance adjustment</option><option>Lock / unlock</option><option>Policy change</option></select></div>
    <div class="fld"><label>User</label><select><option>All users</option><option>Mariam Y.</option></select></div>
    <div class="fld"><label>&nbsp;</label><button class="btn">${ic('filter')} Filter</button></div>
  </div>`
  +tableCard('',['Timestamp','User','Action','Entity','Original → Modified','Reason','IP'],
    [['29 Jul 06:02','system','Attendance processed','160 records','—','Scheduled run','—'],
     ['28 Jul 17:40','Mariam Y.','Balance adjustment','Rohit Nair · AL','10.0 → 12.0','Recall reimbursement','10.20.4.9'],
     ['28 Jul 11:15','Mariam Y.','Medical verified','Sara Menon · SL','Pending → Verified','Cert valid','10.20.4.9'],
     ['27 Jul 18:00','Mariam Y.','Period locked','June 2025','Open → Locked','Payroll cut-off','10.20.4.9'],
     ['26 Jul 09:30','N. Kurup','Leave approved','LV-2045','Pending → Approved','—','10.20.4.31']]
    .map(r=>`<tr><td class="mono" style="font-size:12px">${r[0]}</td><td>${r[1]}</td><td>${bdg('s-b',r[2])}</td><td>${r[3]}</td><td class="mono" style="font-size:12px">${r[4]}</td><td class="muted">${r[5]}</td><td class="mono" style="font-size:12px">${r[6]}</td></tr>`).join(''));


/* ---------------- HR SETTINGS ---------------- */
VIEWS['set-policy']=()=>pageHead('Policy Settings','Configuration-driven attendance & leave policy · no source-code changes required',
    `<button class="btn" onclick="toast('Reverted (visual)')">Cancel</button><button class="btn pri" onclick="toast('Policy saved (visual)')">Save policy</button>`,'Settings')
  +`<div class="row"><div style="flex:1.3">${card('Company policy (FRS §2)',`
    <div class="form-row two">
      <div class="field"><label>Policy name</label><input type="text" value="GSIT Leave and Attendance Policy"></div>
      <div class="field"><label>Effective year</label><input type="text" value="2024"></div>
      <div class="field"><label>Country</label><input type="text" value="United Arab Emirates"></div>
      <div class="field"><label>Applicable employees</label><input type="text" value="All regular employees"></div>
      <div class="field"><label>Working week</label><input type="text" value="Monday to Friday"></div>
      <div class="field"><label>Weekly off</label><input type="text" value="Saturday and Sunday"></div>
      <div class="field"><label>Standard weekly hours</label><input type="text" value="41.5 (excl. breaks)"></div>
      <div class="field"><label>Probation period</label><input type="text" value="6 months"></div>
      <div class="field"><label>Monitoring period</label><input type="text" value="Rolling 12 months"></div>
      <div class="field"><label>Payroll cycles</label><input type="text" value="12 monthly"></div>
      <div class="field"><label>Primary approval authority</label><input type="text" value="Reporting Manager and/or HR"></div>
      <div class="field"><label>Override authority</label><input type="text" value="Authorized HR Administrator"></div>
    </div>`)}
    </div><div style="flex:1">
    ${card('HR confirmations required',
      note('warn','These policy values are <b>undefined in the FRS</b> and must be confirmed before final calculations. Shown as placeholders — not assumed (FRS §28).')+
      `<div style="margin-top:12px">${[['Half-day minimum hours','Exact threshold'],['Full-day minimum hours','Exact threshold'],['Late-minute treatment','Warning / leave / salary deduction'],['Early-departure treatment','Warning / leave / LOP'],['Partial-month AL accrual','Eligible-payday formula'],['Carry-forward workflow','Manager only or +HR'],['Carry-forward expiry','3-month date logic'],['Encashment formula','Gross / basic / component'],['Comp-off ratio','Hours-to-day formula'],['Comp-off expiry','Days / months'],['Overtime rounding','Minute increment'],['Special allowance','Fixed / formula'],['7-day unpaid conversion','Auto / HR-confirmed'],['Nursing-break period','Eligibility duration'],['Occurrence reset','Reset / cumulative'],['Warning validity','12 mo / separate']].map(r=>`<div class="lrow" style="padding:9px 0"><div><div class="li-t" style="font-size:12.5px">${r[0]}</div><div class="li-s">${r[1]}</div></div><div class="li-r">${phFlag('Pending')}</div></div>`).join('')}</div>`,
      {sub:'FRS §28 · Table 17'})}
    </div></div>`;

VIEWS['set-shift']=()=>pageHead('Shift Master','Define working schedules, breaks and variable patterns',
    `<button class="btn pri" onclick="toast('New shift form (visual)')">${ic('plus')} New shift</button>`,'Settings')
  +tableCard('Default office schedule (FRS §4.1)',['Day','Office hours','Break structure','Net hours'],
    [['Monday–Thursday','08:00–18:00','15 + 60 + 15 min','8 h 30 m'],['Friday','08:00–18:00','15 + 120 + 15 min','7 h 30 m']]
    .map(r=>`<tr><td class="fw6">${r[0]}</td><td class="mono">${r[1]}</td><td>${r[2]}</td><td class="num">${r[3]}</td></tr>`).join(''))
  +'<div style="height:16px"></div>'
  +card('Supported shift patterns (FRS §4.3)',`<div class="tag-list">${['Fixed','Flexible','Rotational','Split','Night','Remote','Client-site','On-call'].map(t=>`<span class="chip on">${t}</span>`).join('')}</div>
    <div class="divider"></div><p class="muted">Schedules can vary by department, job role, client assignment, location, employee category and operational requirement. Assignment supports company, group, department and role scope.</p>`)
  +'<div style="height:16px"></div>'
  +tableCard('Configured shifts',['Shift','Type','Timing','Break','Assigned to'],
    [['General','Fixed','08:00–18:00','90 min','All (Dubai)'],['Night Ops','Night','22:00–06:00','60 min','DevOps'],['Client Site','Flexible','Variable','As logged','Field team'],['Ramadan','Fixed','09:00–15:00','30 min','All (temporary)']]
    .map(r=>`<tr><td class="fw6">${r[0]}</td><td>${bdg('s-b',r[1])}</td><td class="mono">${r[2]}</td><td>${r[3]}</td><td>${r[4]}</td></tr>`).join(''));

VIEWS['set-ramadan']=()=>pageHead('Ramadan Schedule','Temporary reduced-hours schedule with automatic revert','','Settings')
  +`<div class="row"><div style="flex:1;max-width:520px">${card('Ramadan configuration (FRS §4.2)',`
    <div class="form-row two">
      <div class="field"><label>Start date</label><input type="date" value="2025-03-01"></div>
      <div class="field"><label>End date</label><input type="date" value="2025-03-30"></div>
      <div class="field"><label>Hours reduction</label><input type="text" value="2 hours"><div class="hint">Or HR-configured value</div></div>
      <div class="field"><label>Assignment scope</label><select><option>Company</option><option>Employee group</option><option>Department</option><option>Role</option></select></div>
      <div class="field"><label>Shift start</label><input type="time" value="09:00"></div>
      <div class="field"><label>Shift end</label><input type="time" value="15:00"></div>
      <div class="field"><label>Break duration</label><input type="text" value="30 min"></div>
      <div class="field"><label>Auto-revert</label><select><option>Enabled — restore standard schedule</option><option>Manual</option></select></div>
    </div>
    <button class="btn pri" onclick="toast('Ramadan schedule saved (visual)')">${ic('sun')} Save Ramadan schedule</button>`)}
    </div><div style="flex:1">${note('info','The standard schedule is retained and automatically reactivated after the Ramadan end date. Reduced hours apply on top of the assigned base shift.')}</div></div>`;

VIEWS['set-holidays']=()=>pageHead('Holiday Calendar Settings','Maintain UAE public holidays by company and location',
    `<button class="btn pri" onclick="toast('Add holiday (visual)')">${ic('plus')} Add holiday</button>`,'Settings')
  +tableCard('2025 · GSIT Dubai (UAE private sector)',['Date','Holiday','Type','Action'],
    HOLIDAYS.map(h=>`<tr><td class="fw6">${h.d}</td><td>${h.n}</td><td>${bdg('s-p',h.type)}</td><td><div class="hb"><button class="btn sm ghost" onclick="toast('Edit (visual)')">${ic('edit')}</button><button class="btn sm ghost" onclick="toast('Removed (visual)')">${ic('x')}</button></div></td></tr>`).join(''));

VIEWS['set-status']=()=>pageHead('Attendance Status Master','Define statuses and their payroll / approval behaviour',
    `<button class="btn pri" onclick="toast('Add status (visual)')">${ic('plus')} Add status</button>`,'Settings')
  +note('info','HR can add statuses and define whether each counts as <b>present, paid, unpaid, payroll-impacting or approval-required</b> (FRS §6).')
  +'<div style="height:16px"></div>'
  +tableCard('Statuses',['Status','Present','Paid','Payroll impact','Approval req.'],
    Object.keys(ST).slice(0,20).map(s=>{const paid=/Annual|Sick|Maternity|Parental|Compassionate|Study|Present|Half|First|Second|Approved|Public|Comp|Overtime|Duty|WFH|Travel|Client/.test(s);const pres=/Present|Half|First|Second|Late|Early|Duty|WFH|Travel|Client|Overtime|Comp/.test(s);const appr=/Approved|Overtime|Comp|Duty|WFH|Late Login|Early Departure/.test(s)&&!/Unscheduled/.test(s);
      return `<tr><td>${statusBadge(s)}</td><td>${pres?bdg('s-g','Yes'):bdg('s-gray','No')}</td><td>${paid?bdg('s-g','Paid'):bdg('s-r','Unpaid')}</td><td>${bdg('s-b','Yes')}</td><td>${appr?bdg('s-a','Yes'):bdg('s-gray','No')}</td></tr>`}).join(''),
    {sub:'Showing 20 of 39 · configurable'});

VIEWS['set-leavetypes']=()=>pageHead('Leave Types','Configure entitlement, accrual, pay tiers and documents',
    `<button class="btn pri" onclick="toast('Add leave type (visual)')">${ic('plus')} Add leave type</button>`,'Settings')
  +tableCard('Leave type master',['Type','Code','Pay','Entitlement','Accrual','Probation','Document'],
    LEAVE_TYPES.map(t=>`<tr><td class="fw6">${t.t}</td><td>${bdg('s-b',t.code)}</td><td>${t.pay}</td><td>${t.ent}</td><td>${t.accrual}</td><td>${t.probation}</td><td class="muted">${t.doc}</td></tr>`).join(''))
  +'<div style="height:16px"></div>'
  +note('warn',`Sick tiers (15 full / 30 half / 45 unpaid) and AL accrual (2.5/mo) are configured; partial-month accrual and encashment formulas remain ${phFlag('HR confirmation pending')}.`);

VIEWS['set-workflows']=()=>pageHead('Approval Workflows','Configure per-request approval routing (FRS §18 · Table 14)',
    `<button class="btn pri" onclick="toast('Workflow saved (visual)')">Save workflows</button>`,'Settings')
  +tableCard('Request workflows',['Request type','Workflow'],
    [['Annual Leave','Employee → Reporting Manager → HR notification/approval as configured'],
     ['Annual Leave Encashment','Employee/HR → Reporting Manager → HR → Payroll'],
     ['Sick Leave','Employee → Reporting Manager → HR document verification where required'],
     ['Compassionate Leave','Employee → Reporting Manager → HR verification'],
     ['Maternity Leave','Employee → Reporting Manager → HR final approval'],
     ['Parental Leave','Employee → Department Manager → HR final approval'],
     ['Hajj / Umrah / Study Leave','Employee → Reporting Manager → HR final approval'],
     ['Unpaid Leave','Employee → Reporting Manager → HR → Payroll notification']]
    .map(r=>`<tr><td class="fw6">${r[0]}</td><td>${r[1].split('→').map(s=>`<span class="chip" style="margin:2px">${s.trim()}</span>`).join('<span style="color:var(--faint)">→</span>')}</td></tr>`).join(''));

/* ---------------- SUPER ADMIN ---------------- */
VIEWS['sa-dash']=()=>pageHead('Organisation Overview','Full access across all companies, branches, policies, integrations and audit','','System')
  +`<div class="grid g-4" style="margin-bottom:16px">
    ${kpi({icon:'building',acc:'b',val:'3',lbl:'Companies'})}
    ${kpi({icon:'location',acc:'p',val:'5',lbl:'Branches'})}
    ${kpi({icon:'users',acc:'g',val:'318',lbl:'Active employees'})}
    ${kpi({icon:'device',acc:'a',val:'8',lbl:'Biometric devices'})}
  </div>
  <div class="row">
    <div style="flex:1.3">${tableCard('Companies & attendance readiness',['Company','Location','Employees','Policy','Finalization'],
      [['GSIT','Dubai (UAE)','142','2024 · v3','July open'],['GSIT','Abu Dhabi (UAE)','96','2024 · v3','July open'],['GSIT Services','Dubai (UAE)','80','2024 · v2','June locked']]
      .map(r=>`<tr><td class="fw6">${r[0]}</td><td>${r[1]}</td><td class="num">${r[2]}</td><td>${bdg('s-b',r[3])}</td><td>${r[4].includes('locked')?bdg('s-g',r[4]):bdg('s-a',r[4])}</td></tr>`).join(''))}
    </div>
    <div style="flex:1">${card('System health',
      `<div class="mini-stat"><span>Biometric sync</span>${bdg('s-g','Healthy')}</div>
       <div class="mini-stat" style="margin-top:10px"><span>API integration</span>${bdg('s-g','Connected')}</div>
       <div class="mini-stat" style="margin-top:10px"><span>Failed records (24h)</span>${bdg('s-a','2')}</div>
       <div class="mini-stat" style="margin-top:10px"><span>Audit log</span>${bdg('s-g','Recording')}</div>
       <div class="divider"></div><button class="btn" onclick="go('sys-audit')">${ic('shield')} System audit</button>`,{sub:'Live'})}
    </div>
  </div>`;

VIEWS['companies']=()=>pageHead('Companies & Branches','Multi-company structure with company-level data separation',
    `<button class="btn pri" onclick="toast('Add company (visual)')">${ic('plus')} Add company</button>`,'Administration')
  +tableCard('Companies',['Company','Country','Branches','Employees','Policy version','Status'],
    [['GSIT','UAE','2','238','2024 · v3','Active'],['GSIT Services','UAE','1','80','2024 · v2','Active'],['GSIT Global','UAE','2','—','Draft','Setup']]
    .map(r=>`<tr><td>${personCell(r[0],r[1])}</td><td>${r[1]}</td><td class="num">${r[2]}</td><td class="num">${r[3]}</td><td>${bdg('s-b',r[4])}</td><td>${r[5]==='Active'?bdg('s-g','Active'):bdg('s-a','Setup')}</td></tr>`).join(''))
  +'<div style="height:16px"></div>'
  +note('info','This module is UAE-only per the current FRS. A Kochi / India variant is <b>not covered</b> in this specification and would require a separate policy configuration.');

VIEWS['biometric']=()=>pageHead('Biometric Devices','Device registry, employee mapping and raw punch logs',
    `<button class="btn pri" onclick="toast('Register device (visual)')">${ic('plus')} Register device</button>`,'Administration')
  +tableCard('Registered devices',['Device','Location','Mapped employees','Last sync','Status'],
    [['BIO-DXB-01','Dubai · Main entrance','142','29 Jul 06:00','Online'],['BIO-DXB-02','Dubai · 3rd floor','142','29 Jul 06:00','Online'],['BIO-AUH-01','Abu Dhabi','96','29 Jul 05:58','Online'],['BIO-DXB-03','Dubai · Server room','12','28 Jul 22:10','Offline']]
    .map(r=>`<tr><td class="fw6 mono">${r[0]}</td><td>${r[1]}</td><td class="num">${r[2]}</td><td class="mono" style="font-size:12px">${r[3]}</td><td>${r[4]==='Online'?bdg('s-g','Online'):bdg('s-r','Offline')}</td></tr>`).join(''))
  +'<div style="height:16px"></div>'
  +tableCard('Recent raw punches (immutable)',['Timestamp','Employee ID','Device','Type','Processing'],
    [['29 Jul 08:04:11','GSIT-0142','BIO-DXB-01','IN','Processed'],['29 Jul 08:00:02','GSIT-0138','BIO-DXB-01','IN','Processed'],['29 Jul 08:22:47','GSIT-0147','BIO-DXB-02','IN','Processed'],['24 Jul 09:10:00','GSIT-0163','BIO-DXB-01','IN','Failed → reprocess']]
    .map(r=>`<tr><td class="mono" style="font-size:12px">${r[0]}</td><td class="mono">${r[1]}</td><td class="mono">${r[2]}</td><td>${bdg(r[3]==='IN'?'s-g':'s-a',r[3])}</td><td>${r[4].includes('Failed')?bdg('s-r',r[4]):bdg('s-g',r[4])}</td></tr>`).join(''),
    {sub:'Raw records are never overwritten'});

VIEWS['integrations']=()=>pageHead('API & Integrations','Punch submission, employee/shift sync and webhooks','','Administration')
  +`<div class="grid g-2">
    ${card('API access',`<div class="dl"><dt>Endpoint</dt><dd class="mono" style="font-size:12px">/api/v1/attendance/punch</dd><dt>Auth</dt><dd>Bearer token (secure)</dd><dt>Rate limit</dt><dd>600 / min</dd><dt>Status</dt><dd>${bdg('s-g','Connected')}</dd></div><div class="divider"></div><button class="btn" onclick="toast('Key rotated (visual)')">${ic('key')} Rotate key</button>`)}
    ${card('Sync jobs',`<div class="lrow"><div class="li-t">Employee sync</div><div class="li-r">${bdg('s-g','Hourly')}</div></div><div class="lrow"><div class="li-t">Shift sync</div><div class="li-r">${bdg('s-g','Hourly')}</div></div><div class="lrow"><div class="li-t">Biometric import</div><div class="li-r">${bdg('s-g','06:00 daily')}</div></div><div class="lrow"><div class="li-t">Payroll export</div><div class="li-r">${bdg('s-a','Monthly · manual')}</div></div>`)}
  </div>`
  +'<div style="height:16px"></div>'
  +note('info','API-based punch submission preserves raw records and supports error handling and reprocessing. Secure APIs, device authorization and session timeout apply (FRS §5, §25).');

VIEWS['roles-perms']=()=>pageHead('Roles & Permissions','Role-based access control across the module (FRS §3)','','Administration')
  +tableCard('Permission matrix',['Capability','Employee','Manager','HR Admin','Super Admin'],
    [['Check-in / out & own requests','y','y','y','y'],
     ['View team attendance','n','y','y','y'],
     ['Approve leave / regularization','n','y','y','y'],
     ['Configure policies & shifts','n','n','y','y'],
     ['Verify medical documents','n','n','y','y'],
     ['Override attendance','n','n','y','y'],
     ['Create / waive occurrences','n','n','y','y'],
     ['Lock / reopen payroll period','n','n','y','y'],
     ['Manage companies & branches','n','n','n','y'],
     ['Manage integrations & devices','n','n','n','y'],
     ['View system audit & security','n','n','partial','y']]
    .map(r=>`<tr><td class="fw6">${r[0]}</td>${r.slice(1).map(c=>`<td>${c==='y'?bdg('s-g','✓'):c==='partial'?bdg('s-a','Scoped'):bdg('s-gray','—')}</td>`).join('')}</tr>`).join(''))
  +'<div style="height:16px"></div>'
  +note('info','Access includes company-level data separation, encryption, session timeout, device authorization and restricted access to medical information (FRS §25).');

VIEWS['sys-audit']=()=>pageHead('System Audit & Security','Cross-company audit trail and security configuration','','Administration')
  +`<div class="grid g-4" style="margin-bottom:16px">
    ${kpi({icon:'shield',acc:'g',val:'On',lbl:'Audit logging'})}
    ${kpi({icon:'lock',acc:'g',val:'AES-256',lbl:'Encryption at rest'})}
    ${kpi({icon:'clock',acc:'b',val:'30 min',lbl:'Session timeout'})}
    ${kpi({icon:'device',acc:'p',val:'On',lbl:'Device authorization'})}
  </div>`
  +tableCard('System-wide audit (all companies)',['Timestamp','Company','User','Action','Detail'],
    [['29 Jul 06:02','All','system','Processing run','318 records'],
     ['28 Jul 17:40','GSIT Dubai','Mariam Y.','Balance adjustment','Rohit Nair · AL +2.0'],
     ['27 Jul 18:00','GSIT Dubai','Mariam Y.','Period locked','June 2025'],
     ['26 Jul 14:20','GSIT Services','System Owner','Policy change','Shift master updated'],
     ['25 Jul 10:05','All','System Owner','Device registered','BIO-DXB-03']]
    .map(r=>`<tr><td class="mono" style="font-size:12px">${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${bdg('s-b',r[3])}</td><td class="muted">${r[4]}</td></tr>`).join(''));

/* ============================================================
   RUNTIME PART 1 — toasts, modals, shared handlers (reused by views)
   ============================================================ */
function route(){renderContent();}   /* calMove() and legacy calls use this */

function toast(msg){
  const w=__$('toastWrap');
  const t=document.createElement('div'); t.className='toast';
  t.innerHTML=`${ic('check')}<span>${msg}</span>`;
  w.appendChild(t);
  setTimeout(()=>{t.style.opacity='0';t.style.transform='translateY(10px)';t.style.transition='.25s';setTimeout(()=>t.remove(),260);},2600);
}
let __closeT;
function openModal(html){const o=__$('modalOv');if(!o)return;clearTimeout(__closeT);o.classList.remove('closing');__$('modalHost').innerHTML=html;o.classList.add('show');}
function closeModal(){const o=__$('modalOv');if(!o||!o.classList.contains('show')||o.classList.contains('closing'))return;o.classList.add('closing');clearTimeout(__closeT);__closeT=setTimeout(()=>{o.classList.remove('show','closing');},220);}
function modalShell(title,body,footer,size){
  return `<div class="modal ${size||''}"><div class="modal-h"><h3>${title}</h3><button class="x" onclick="closeModal()">${ic('x')}</button></div>
    <div class="modal-b">${body}</div>${footer!==false?`<div class="modal-f">${footer||`<button class="btn" onclick="closeModal()">Cancel</button><button class="btn pri" onclick="submitModal()">Submit</button>`}</div>`:''}</div>`;
}
function submitModal(){closeModal();toast('Submitted for approval (visual only)');}

function openNotifications(){
  const items=[['alert','Layla Hassan — unauthorized absence','LOP + disciplinary case created','r'],['inbox','3 approvals pending','Leave, regularization & overtime','a'],['doc','2 medical certificates awaiting verification','Sick leave','b'],['wallet','7 employees — AL carry-forward expiring','Within 90 days','a']];
  openModal(modalShell('Notifications',items.map(n=>`<div class="lrow"><div class="li-ic" style="background:var(--${n[3]}-bg);color:var(--${n[3]})">${ic(n[0])}</div><div><div class="li-t">${n[1]}</div><div class="li-s">${n[2]}</div></div></div>`).join(''),`<button class="btn ghost" onclick="toast('Marked all read')">Mark all read</button><button class="btn" onclick="closeModal()">Close</button>`,'sm'));
}
function openQuickAdd(){
  const acts=[['clock','Check-in / out',()=>{closeModal();navModule('home','my','overview');}],['plus','Apply leave',()=>{closeModal();openApplyLeave();}],['edit','Regularize',()=>{closeModal();navModule('attendance','my','regularization');}],['clock2','Request overtime',()=>{closeModal();openOtModal();}]];
  window.__qa=acts;
  openModal(modalShell('Quick actions',`<div class="grid g-2">${acts.map((a,i)=>`<div class="card" style="cursor:pointer" onclick="window.__qa[${i}][2]()"><div class="card-b" style="text-align:center;padding:20px"><div style="margin:0 auto 8px;width:40px;height:40px;background:var(--brand-050);color:var(--brand);border-radius:11px;display:grid;place-items:center">${ic(a[0])}</div><div class="fw6" style="font-size:13px">${a[1]}</div></div></div>`).join('')}</div>`,false,'sm'));
}
function openApplyLeave(){
  openModal(modalShell('Apply for leave',
    `<div class="form-row two">
      <div class="field"><label>Leave type <span class="req">*</span></label><select id="alType" onchange="updateLeaveHints()">${LEAVE_TYPES.map(t=>`<option>${t.t}</option>`).join('')}</select></div>
      <div class="field"><label>Classification</label><select><option>Personal</option><option>Official</option></select></div>
      <div class="field"><label>From date <span class="req">*</span></label><input type="date"></div>
      <div class="field"><label>To date <span class="req">*</span></label><input type="date"><div class="hint">To Date = day before reporting back</div></div>
    </div>
    <div class="field" style="margin-bottom:14px"><label>Reason <span class="req">*</span></label><textarea placeholder="Provide a reason"></textarea></div>
    <div class="field" style="margin-bottom:14px"><label>Supporting document <span id="docReq" class="muted">(optional)</span></label><div class="upload" onclick="toast('Uploads inert')">${ic('file')} Attach (inert)</div></div>
    <div id="valList" style="border-top:1px solid var(--line-2);padding-top:8px">${valChecklist('Annual Leave')}</div>`,
    `<button class="btn" onclick="closeModal()">Cancel</button><button class="btn pri" onclick="closeModal();toast('Leave application submitted (visual)')">Submit application</button>`,'lg'));
}
function updateLeaveHints(){
  const t=__$('alType'); if(!t)return; const type=t.value;
  const vl=__$('valList'); if(vl)vl.innerHTML=valChecklist(type);
  const dr=__$('docReq');
  const req={'Sick Leave':'(certificate conditional)','Maternity':'(mandatory)','Parental':'(mandatory)','Compassionate':'(mandatory)','Hajj':'(evidence)','Study':'(exam evidence)'};
  const k=Object.keys(req).find(k=>type.includes(k)); if(dr)dr.textContent=k?req[k]:'(optional)';
}
function openRegModal(){
  openModal(modalShell('New regularization request',
    `<div class="form-row two">
      <div class="field"><label>Reason type <span class="req">*</span></label><select>${['Missing punch','Biometric failure','Incorrect shift','Client site','Work from home','Official meeting','Business travel','System error'].map(o=>`<option>${o}</option>`).join('')}</select></div>
      <div class="field"><label>Date <span class="req">*</span></label><input type="date"></div>
      <div class="field"><label>From time</label><input type="time" value="08:00"></div>
      <div class="field"><label>To time</label><input type="time" value="18:00"></div>
      <div class="field"><label>Classification</label><select><option>Official</option><option>Personal</option></select></div>
      <div class="field"><label>Requested status</label><select><option>Present</option><option>On Duty</option><option>Work from Home</option><option>Client Site</option></select></div>
    </div>
    <div class="field" style="margin-bottom:14px"><label>Reason <span class="req">*</span></label><textarea></textarea></div>
    <div class="field"><label>Attachment</label><div class="upload" onclick="toast('Uploads inert')">${ic('file')} Attach evidence (inert)</div></div>`));
}
function openReqModal(){
  openModal(modalShell('New late / early / shift request',
    `<div class="form-row two"><div class="field"><label>Request type <span class="req">*</span></label><select><option>Scheduled Late Login</option><option>Early Departure</option><option>Shift Change</option></select></div>
      <div class="field"><label>Date <span class="req">*</span></label><input type="date"></div>
      <div class="field"><label>From time</label><input type="time"></div><div class="field"><label>To time</label><input type="time"></div></div>
    <div class="field"><label>Reason <span class="req">*</span></label><textarea></textarea></div>
    <div class="hint" style="margin-top:8px">Prior approval reclassifies this as scheduled and excludes it from occurrence counting.</div>`));
}
function openPlanModal(){
  openModal(modalShell('Propose annual-leave segment',
    `<div class="form-row two"><div class="field"><label>From date <span class="req">*</span></label><input type="date"></div><div class="field"><label>To date <span class="req">*</span></label><input type="date"></div></div>
     ${note('info','Segment must be ≥ 7 calendar days with a ≥ 3-month gap. Submit 30–45 days ahead.')}
     <div class="field" style="margin-top:14px"><label>Notes to manager</label><textarea></textarea></div>`,
    `<button class="btn" onclick="closeModal()">Cancel</button><button class="btn pri" onclick="closeModal();toast('Segment proposed (visual)')">Propose segment</button>`));
}
function openOtModal(){
  openModal(modalShell('Request overtime',
    `<div class="form-row two"><div class="field"><label>Date <span class="req">*</span></label><input type="date"></div>
      <div class="field"><label>Hours <span class="req">*</span></label><input type="number" value="2" step="0.5"></div>
      <div class="field"><label>Category</label><select><option>Normal (+25%)</option><option>Night 10PM–4AM (+50%)</option><option>Weekend / holiday</option></select></div>
      <div class="field"><label>Preferred compensation</label><select><option>Overtime payment</option><option>Special allowance</option><option>Compensatory off</option><option>Alternative day off</option></select></div></div>
    <div class="field"><label>Reason <span class="req">*</span></label><textarea></textarea></div>
    ${note('warn','Overtime requires manager approval. Unapproved time is not payable.')}`));
}
function openLeaveQuick(type){openModal(modalShell('Request — '+type,`<div class="form-row two"><div class="field"><label>Date</label><input type="date"></div><div class="field"><label>Type</label><input type="text" value="${type}" readonly></div></div><div class="field"><label>Reason</label><textarea></textarea></div>`,`<button class="btn" onclick="closeModal()">Cancel</button><button class="btn pri" onclick="closeModal();toast('Request submitted (visual)')">Submit</button>`,'sm'));}
function openApprove(id,emp,kind,action){
  const rej=action==='reject';
  openModal(modalShell((rej?'Reject':'Approve')+' — '+id,
    `<div class="dl" style="margin-bottom:14px"><dt>Employee</dt><dd>${emp}</dd><dt>Request</dt><dd>${kind}</dd><dt>Reference</dt><dd class="mono">${id}</dd></div>
     <div class="field"><label>${rej?'Rejection reason':'Comment'} ${rej?'<span class="req">*</span>':''}</label><textarea placeholder="${rej?'Explain why':'Optional note'}"></textarea></div>
     ${kind.includes('Annual')?`<div style="margin-top:12px"><label class="fw6" style="font-size:12.5px">Or propose alternative dates</label><div class="form-row two" style="margin-top:6px"><input type="date"><input type="date"></div></div>`:''}`,
    `<button class="btn" onclick="closeModal()">Cancel</button><button class="btn ${rej?'danger':'pri'}" onclick="closeModal();toast('${id} ${rej?'rejected':'approved'} (visual)')">${rej?'Reject':'Approve'} request</button>`,'sm'));
}
function openAltModal(emp){openModal(modalShell('Propose alternative dates',`<p class="muted" style="margin-bottom:12px">For ${emp}. The employee will be notified to revise.</p><div class="form-row two"><div class="field"><label>Suggested from</label><input type="date"></div><div class="field"><label>Suggested to</label><input type="date"></div></div><div class="field"><label>Reason</label><textarea></textarea></div>`,`<button class="btn" onclick="closeModal()">Cancel</button><button class="btn pri" onclick="closeModal();toast('Alternative proposed (visual)')">Send</button>`,'sm'));}
function openWaiveModal(emp){openModal(modalShell('Waive occurrence — '+emp,`${note('warn','Waiving requires a reason and is audited.')}<div class="field" style="margin-top:14px"><label>Waiver reason <span class="req">*</span></label><textarea></textarea></div>`,`<button class="btn" onclick="closeModal()">Cancel</button><button class="btn pri" onclick="closeModal();toast('Occurrence waived (visual)')">Waive</button>`,'sm'));}
function openManualModal(emp){openModal(modalShell('Manual attendance correction — '+emp,`${note('warn','Reason and attachment are mandatory. Raw record preserved.')}<div class="form-row two" style="margin-top:14px"><div class="field"><label>Corrected check-in</label><input type="time"></div><div class="field"><label>Corrected check-out</label><input type="time"></div></div><div class="field" style="margin-bottom:14px"><label>Reason <span class="req">*</span></label><textarea></textarea></div><div class="field"><label>Attachment <span class="req">*</span></label><div class="upload" onclick="toast('Uploads inert')">${ic('file')} Attach (inert)</div></div>`,`<button class="btn" onclick="closeModal()">Cancel</button><button class="btn pri" onclick="closeModal();toast('Correction saved & audited (visual)')">Save</button>`));}
function openDecisionModal(id,kind){openModal(modalShell('HR decision — '+id,`${note('warn','No termination is automated. Records HR decision, warning reference and audit.')}<div class="field" style="margin-top:14px"><label>Decision</label><select><option ${kind==='confirm'?'selected':''}>Issue recommended warning</option><option>Downgrade action</option><option ${kind==='waive'?'selected':''}>Waive — no action</option></select></div><div class="field" style="margin-top:12px"><label>Warning reference</label><input type="text" placeholder="WRN-2025-014"></div><div class="field" style="margin-top:12px"><label>HR notes</label><textarea></textarea></div>`,`<button class="btn" onclick="closeModal()">Cancel</button><button class="btn pri" onclick="closeModal();toast('Decision recorded (visual)')">Record</button>`,'sm'));}
function openLockModal(){openModal(modalShell('Lock July 2026',`${note('warn','Locking finalizes attendance for payroll. Post-lock changes require reopening with a reason.')}<div class="field" style="margin-top:14px"><label>Confirmation</label><input type="text" placeholder="Type LOCK to confirm"></div>`,`<button class="btn" onclick="closeModal()">Cancel</button><button class="btn pri" onclick="closeModal();toast('Period locked (visual)')">Lock period</button>`,'sm'));}
function openReopenModal(){openModal(modalShell('Reopen locked period',`${note('warn','Requires HR authorization, a reason and a payroll adjustment. Fully audited.')}<div class="field" style="margin-top:14px"><label>Period</label><select><option>June 2026 (locked)</option></select></div><div class="field" style="margin-top:12px"><label>Reopening reason <span class="req">*</span></label><textarea></textarea></div>`,`<button class="btn" onclick="closeModal()">Cancel</button><button class="btn danger" onclick="closeModal();toast('Period reopened & audited (visual)')">Reopen</button>`,'sm'));}
function openScheduleModal(){openModal(modalShell('Schedule report delivery',`<div class="form-row two"><div class="field"><label>Report</label><select><option>Daily attendance</option><option>Monthly attendance</option><option>Leave liability</option></select></div><div class="field"><label>Frequency</label><select><option>Daily</option><option>Weekly</option><option>Monthly</option></select></div><div class="field"><label>Format</label><select><option>Excel</option><option>CSV</option><option>PDF</option></select></div><div class="field"><label>Recipients</label><input type="text" placeholder="hr@gs-it.ae"></div></div>`,`<button class="btn" onclick="closeModal()">Cancel</button><button class="btn pri" onclick="closeModal();toast('Delivery scheduled (visual)')">Schedule</button>`,'sm'));}
function openAdjModal(){openModal(modalShell('New balance adjustment',`<div class="form-row two"><div class="field"><label>Employee</label><select>${EMP.map(e=>`<option>${e.n}</option>`).join('')}</select></div><div class="field"><label>Leave type</label><select>${LEAVE_TYPES.map(t=>`<option>${t.t}</option>`).join('')}</select></div><div class="field"><label>Change (± days)</label><input type="number" value="0" step="0.5"></div><div class="field"><label>Effective date</label><input type="date"></div></div><div class="field"><label>Reason <span class="req">*</span></label><textarea></textarea></div>`,`<button class="btn" onclick="closeModal()">Cancel</button><button class="btn pri" onclick="closeModal();toast('Adjustment saved & audited (visual)')">Save</button>`));}
function filterApprovals(k){__$$('#view .tabs .tab').forEach(t=>t.classList.toggle('active',t.textContent.toLowerCase().startsWith(k==='all'?'all':k)));toast('Filtered: '+k);}
function filterExceptions(k){const t=__$$('#view .tabs .tab');t.forEach(x=>x.classList.remove('active'));if(typeof event!=='undefined'&&event&&event.target)event.target.classList.add('active');toast('Filtered: '+k);}
let clockTimer=null, punchedIn=true;
function startClock(){if(clockTimer)clearInterval(clockTimer);const el=__$('liveClock');if(!el)return;clockTimer=setInterval(()=>{const el=__$('liveClock');if(!el){clearInterval(clockTimer);return;}const n=new Date();el.textContent=String(n.getHours()).padStart(2,'0')+':'+String(n.getMinutes()).padStart(2,'0')+':'+String(n.getSeconds()).padStart(2,'0');},1000);}
function togglePunch(){const btn=__$('punchBtn'),log=__$('punchLog'),sub=__$('punchSub'),st=__$('punchStatus');const now=new Date(),t=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0')+':'+String(now.getSeconds()).padStart(2,'0');if(!btn)return;if(punchedIn){punchedIn=false;btn.className='punch-btn in';btn.querySelector('span').textContent='Check In';if(sub)sub.textContent='Checked out';if(log)log.insertAdjacentHTML('beforeend',`<tr><td class="mono">${t}</td><td>Check-Out</td><td>Web</td><td class="mono">10.20.4.18</td><td>${bdg('s-g','On time')}</td></tr>`);if(st)st.innerHTML=statusBadge('Present');toast('Checked out at '+t.slice(0,5));}else{punchedIn=true;btn.className='punch-btn out';btn.querySelector('span').textContent='Check Out';if(sub)sub.textContent='Checked in at '+t.slice(0,5);if(log)log.insertAdjacentHTML('beforeend',`<tr><td class="mono">${t}</td><td>Check-In</td><td>Web</td><td class="mono">10.20.4.18</td><td>${bdg('s-g','On time')}</td></tr>`);toast('Checked in at '+t.slice(0,5));}}
/* profile-card timer */
let pcTimer=null;
function startPcTimer(){if(pcTimer)clearInterval(pcTimer);let s=2*3600+9*60+41;const set=()=>{const el=__$('pcTimer');if(!el){clearInterval(pcTimer);return;}s++;const hh=String(Math.floor(s/3600)).padStart(2,'0'),mm=String(Math.floor(s%3600/60)).padStart(2,'0'),ss=String(s%60).padStart(2,'0');el.innerHTML=`<span class="seg">${hh}</span><span class="cln">:</span><span class="seg">${mm}</span><span class="cln">:</span><span class="seg">${ss}</span>`;};set();pcTimer=setInterval(set,1000);}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&window.__laRoot&&window.__laRoot.isConnected)closeModal();});

/* ============================================================
   RUNTIME PART 2 — ZOHO-STYLE INFORMATION ARCHITECTURE
   ============================================================ */
/* extra mock data */
const REPORTEES=[
  {id:'9518096',n:'Krishnapriya PS',d:'Digital Marketing Trainee',st:'In'},
  {id:'9518115',n:'Sruthi Unnikrishnan',d:'Inside Sales Specialist',st:'In'},
  {id:'9518131',n:'Abhiram H Nair',d:'Marketing Support Executive',st:'In'},
  {id:'9518135',n:'Krishnapriya K',d:'SEO Trainee',st:'Out'},
];
const ATT_WEEK=[
  {d:'Sun',n:26,st:'Weekend',cls:'a'},{d:'Mon',n:27,st:'Present',hrs:'09:26 Hrs',cls:'g'},
  {d:'Tue',n:28,st:'Present',hrs:'—',cls:'g'},{d:'Wed',n:29,st:'Present',hrs:'09:20 Hrs',cls:'g'},
  {d:'Thu',n:30,st:'Present',hrs:'01:59 Hrs',cls:'g',today:true},{d:'Fri',n:31,st:'',hrs:'',cls:''},
  {d:'Sat',n:1,st:'Weekend',cls:'a'},
];
const ATT_LIST=[
  {date:'Sun, 26-Jul-2026',in:'-',out:'-',total:'-',pay:'08:00',dev:'00:00',devc:'g',st:'Weekend',stc:'a',shift:'General'},
  {date:'Mon, 27-Jul-2026',in:'09:44 AM',out:'07:10 PM',total:'09:26',pay:'08:00',dev:'01:26',devc:'g',st:'Present',stc:'g',shift:'General'},
  {date:'Tue, 28-Jul-2026',in:'09:45 AM',out:'-',total:'-',pay:'-',dev:'08:00',devc:'r',st:'Present',stc:'g',shift:'General'},
  {date:'Wed, 29-Jul-2026',in:'09:57 AM',out:'07:17 PM',total:'09:20',pay:'08:00',dev:'01:20',devc:'g',st:'Present',stc:'g',shift:'General'},
  {date:'Thu, 30-Jul-2026',in:'10:01 AM',out:'-',total:'02:06',pay:'-',dev:'08:00',devc:'r',st:'Present',stc:'g',shift:'General'},
  {date:'Fri, 31-Jul-2026',in:'-',out:'-',total:'-',pay:'-',dev:'-',st:'',stc:'',shift:'General'},
  {date:'Sat, 01-Aug-2026',in:'-',out:'-',total:'-',pay:'08:00',dev:'-',st:'Weekend',stc:'a',shift:'General'},
];
const LV_CARDS=[
  {t:'Compensatory Off',ic:'gift',bg:'#e7f6ee',fg:'#1f9d63',avail:0,ac:'',booked:3},
  {t:'Earned Leave',ic:'sun',bg:'#e7f6ee',fg:'#1f9d63',avail:14,ac:'var(--g)',booked:3.5},
  {t:'Leave Without Pay',ic:'flame',bg:'#fce9e7',fg:'#d5493f',avail:null,ac:'',booked:0},
  {t:'Sick Leave',ic:'baby',bg:'#f0eafc',fg:'#7a4bd0',avail:6.5,ac:'var(--g)',booked:3.5},
  {t:'Weekly Off',ic:'sun',bg:'#fce9e7',fg:'#d5493f',avail:0,ac:'',booked:0},
  {t:'Work From Home',ic:'home',bg:'#e7f0fc',fg:'#2f6fd6',avail:-6,ac:'var(--r)',booked:0},
];

/* personas & structure */
const PERSONAS={
  employee:{name:'Afzal Haneefa',av:'AF',role:'Employee', modules:['home','leave','attendance','reports'],
    scopes:{home:['my'],leave:['my','holidays'],attendance:['my'],reports:[]}},
  lead:{name:'Afzal Haneefa',av:'AF',role:'Team Lead', modules:['home','leave','attendance','reports'],
    scopes:{home:['my','team'],leave:['my','team','holidays'],attendance:['my','team'],reports:[]}},
  hr:{name:'Mariam Yousef',av:'MY',role:'HR Administrator', settings:true, modules:['home','leave','attendance','reports','operations'],
    scopes:{home:['my','team','org'],leave:['my','team','holidays'],attendance:['my','team'],reports:[]}},
  admin:{name:'System Owner',av:'SO',role:'Super Administrator', settings:true, admin:true, modules:['home','leave','attendance','reports','operations'],
    scopes:{home:['my','team','org'],leave:['my','team','holidays'],attendance:['my','team'],reports:[]}},
};
const RAIL_DEF={home:['home','Home'],leave:['umbrella','Leave Tracker'],attendance:['attendance','Attendance'],reports:['pie','Reports'],operations:['grid','Operations']};
const MODCFG={
  home:{scopeLabels:{my:'My Space',team:'Team',org:'Organization'},
    tabs:{my:['overview','dashboard','calendar'],team:['reportees','approvals','exemp'],org:['overview','announcements','policies','newhires']},
    tabLabels:{overview:'Overview',dashboard:'Dashboard',calendar:'Calendar',reportees:'Reportees',approvals:'Approvals',exemp:'Ex-Employees',announcements:'Announcements',policies:'Policies',newhires:'New Hires'}},
  leave:{scopeLabels:{my:'My Data',team:'Team',holidays:'Holidays'},
    tabs:{my:['summary','requests','comp'],team:['calendar','approvals'],holidays:['list']},
    tabLabels:{summary:'Leave Summary',requests:'Leave Requests',comp:'Compensatory Request',calendar:'Team Leave',approvals:'Approvals',list:'Holiday Calendar'}},
  attendance:{scopeLabels:{my:'My Data',team:'Team'},
    tabs:{my:['summary','regularization'],team:['summary']},
    tabLabels:{summary:'Attendance Summary',regularization:'Regularization'}},
};
/* operations services (management hub) */
const OPS_SERVICES=[
  {sec:'Attendance',items:[
    ['processing','Attendance Processing','refresh','#2f6fd6','att-processing'],
    ['exceptions','Exceptions','alert','#c6851b','exceptions'],
    ['statuses','Attendance Statuses','grid','#2f6fd6','set-status'],
    ['shift','Shift Master','briefcase','#7a4bd0','set-shift'],
    ['ramadan','Ramadan Schedule','sun','#c6851b','set-ramadan'],
  ]},
  {sec:'Leave',items:[
    ['leavetypes','Leave Types','wallet','#1f9d63','set-leavetypes'],
    ['docverify','Document Verification','doc','#2f6fd6','doc-verify'],
    ['balanceadj','Balance Adjustment','scale','#7a4bd0','balance-adj'],
    ['carryforward','Carry Forward','history','#c6851b','carry-forward'],
    ['encashment','Encashment','gift','#1f9d63','encashment'],
    ['maternity','Maternity / Parental','baby','#7a4bd0','maternity'],
    ['holidayset','Holiday Calendar','gift','#c6851b','set-holidays'],
  ]},
  {sec:'Compliance',items:[
    ['occurrences','Occurrences','shield','#d5493f','occurrence-mgmt'],
    ['discipline','Discipline Cases','scale','#d5493f','discipline'],
    ['workflows','Approval Workflows','swap','#2f6fd6','set-workflows'],
  ]},
  {sec:'Payroll & Output',items:[
    ['overtime','Overtime & Comp-Off','clock2','#1f9d63','hr-ot'],
    ['finalization','Finalize & Lock','lock','#7a4bd0','finalization'],
    ['payroll','Payroll Export','download','#2f6fd6','payroll-export'],
    ['reports','Reports','chart','#1f9d63','reports'],
    ['audit','Audit Logs','history','#6b7690','audit'],
  ]},
  {sec:'Configuration',items:[
    ['policy','Policy Settings','gear','#6b7690','set-policy'],
  ]},
  {sec:'Administration',admin:true,items:[
    ['companies','Companies & Branches','building','#2f6fd6','companies'],
    ['roles','Roles & Permissions','key','#7a4bd0','roles-perms'],
    ['biometric','Biometric Devices','device','#c6851b','biometric'],
    ['integrations','API & Integrations','plug','#1f9d63','integrations'],
    ['sysaudit','System Audit','shield','#d5493f','sys-audit'],
  ]},
];
const SVC_INDEX={}; OPS_SERVICES.forEach(s=>s.items.forEach(it=>SVC_INDEX[it[0]]={label:it[1],view:it[4]}));

/* state */
let PERSONA='employee', MODULE='home', SCOPE='my', TAB='overview', ATT_VIEW='list', OPS=null;

/* ---- renderers for chrome ---- */
function renderRail(){
  const mods=PERSONAS[PERSONA].modules;
  __$('railScroll').innerHTML=mods.map(m=>{
    const [icn,lbl]=RAIL_DEF[m];const badge=(m==='home'&&PERSONA!=='employee')?'':'';
    return `<div class="rail-i ${m===MODULE?'active':''}" onclick="navModule('${m}')"><div class="rc">${ic(icn)}</div><span>${lbl}</span></div>`;
  }).join('');
}
function renderScopeTabs(){
  const el=__$('scopeTabs');
  if(MODULE==='operations'){el.innerHTML=`<div class="tb-title">Operations</div>`;return;}
  if(MODULE==='reports'){el.innerHTML=`<div class="tb-title">Reports</div>`;return;}
  const cfg=MODCFG[MODULE], avail=PERSONAS[PERSONA].scopes[MODULE]||[];
  el.innerHTML=avail.map(s=>`<div class="scope-tab ${s===SCOPE?'active':''}" onclick="navScope('${s}')">${cfg.scopeLabels[s]}</div>`).join('');
}
function renderSubbar(){
  const bar=__$('subbar');
  if(MODULE==='operations'||MODULE==='reports'){bar.style.display='none';bar.innerHTML='';return;}
  const cfg=MODCFG[MODULE], tabs=cfg.tabs[SCOPE]||[];
  bar.style.display='flex';
  bar.innerHTML=tabs.map(t=>{
    const badge=(t==='approvals')?'<span class="cb">3</span>':'';
    return `<div class="ctab ${t===TAB?'active':''}" onclick="navTab('${t}')">${cfg.tabLabels[t]}${badge}</div>`;
  }).join('');
}
function renderContent(){
  const v=__$('view');
  let out;
  if(MODULE==='operations'){out=OPS===null?opsHub():opsService(OPS);}
  else if(MODULE==='reports'){out=VIEWS['reports']();}
  else{const fn=DISPATCH[MODULE+'/'+SCOPE+'/'+TAB];out=fn?fn():`<div class="empty"><div class="ei">${ic('grid')}</div>Screen not available for this view.</div>`;}
  if(typeof out==='string'){v.innerHTML=out;} else {v.innerHTML=out.html; if(out.mount)setTimeout(out.mount,0);}
  v.scrollTop=0;window.scrollTo(0,0);
}
function renderAll(){renderRail();renderScopeTabs();renderSubbar();renderContent();
  __$('settingsBtn').style.display=PERSONAS[PERSONA].settings?'grid':'none';}

/* ---- navigation ---- */
function navModule(m,scope,tab){
  MODULE=m;OPS=null;
  if(m==='reports'||m==='operations'){SCOPE=null;TAB=null;}
  else{const avail=PERSONAS[PERSONA].scopes[m]||[];SCOPE=(scope&&avail.includes(scope))?scope:avail[0];
    const tabs=MODCFG[m].tabs[SCOPE];TAB=(tab&&tabs.includes(tab))?tab:tabs[0];}
  renderAll();if(window.innerWidth<=1024)toggleRail(false);
}
function navScope(s){SCOPE=s;TAB=MODCFG[MODULE].tabs[s][0];renderAll();}
function navTab(t){TAB=t;renderAll();}
function openService(k){OPS=k;renderAll();}
function backOps(){OPS=null;renderAll();}
function setAttView(v){ATT_VIEW=v;renderContent();}
function toggleRail(open){const r=__$('rail'),o=__$('railOv');if(open){r.classList.add('open');o.classList.add('show');}else{r.classList.remove('open');o.classList.remove('show');}}
function setPersona(p,silent){
  PERSONA=p;const info=PERSONAS[p];
  __$('pAv').textContent=info.av;
  __$('pName').textContent=info.name;
  __$('pRole').textContent=info.role;
  closeModal();OPS=null;navModule('home');if(!silent)toast('Switched to '+info.role+' view');
}
function openPersonaMenu(){
  openModal(modalShell('Switch view',
    `<p class="muted" style="margin-bottom:14px">Zoho-style spaces adapt to the persona. A Team Lead adds a <b>Team</b> space; HR/Admin add <b>Organization</b> and the <b>Operations</b> hub.</p>
     <div class="pmenu stack" style="gap:10px">${Object.entries(PERSONAS).map(([k,r])=>`<div class="card" style="${k===PERSONA?'border-color:var(--brand);box-shadow:0 0 0 2px var(--brand-050)':''}" onclick="setPersona('${k}')"><div class="card-b" style="display:flex;align-items:center;gap:12px;padding:14px 16px"><div class="avatar" style="background:${k===PERSONA?'var(--brand)':'var(--gray)'}">${r.av}</div><div><div class="fw6">${r.role}</div><div class="muted" style="font-size:12.5px">${r.name} · spaces: ${(r.modules.includes('operations')?'My · Team · Org · Ops':r.scopes.home.length>1?'My · Team':'My Space')}</div></div>${k===PERSONA?`<div style="margin-left:auto">${bdg('s-b','Current')}</div>`:`<div style="margin-left:auto;color:var(--faint)">${ic('chevR')}</div>`}</div></div>`).join('')}</div>`,
    `<button class="btn" onclick="closeModal()">Close</button>`,'sm'));
}
function openSettings(){navModule('operations');openService('policy');}
function go(key){ /* legacy compatibility for reused views */
  if(SVC_INDEX[key]){MODULE='operations';OPS=key;renderAll();return;}
  const map={'my-attendance':['attendance','my','summary'],'checkin':['home','my','overview'],'regularization':['attendance','my','regularization'],'ee-requests':['attendance','my','regularization'],'leave-balances':['leave','my','summary'],'apply-leave':['leave','my','summary'],'al-plan':['leave','my','summary'],'leave-history':['leave','my','requests'],'ot-compoff':['leave','my','comp'],'holidays':['leave','holidays','list'],'team-attendance':['attendance','team','summary'],'team-leave-cal':['leave','team','calendar'],'approvals':['home','team','approvals'],'reports':['reports',null,null]};
  if(map[key]){const[m,s,t]=map[key];navModule(m,s,t);return;}
  // ops service view-keys used directly by reused views
  const svcByView=Object.keys(SVC_INDEX).find(k=>SVC_INDEX[k].view===key);
  if(svcByView){MODULE='operations';OPS=svcByView;renderAll();return;}
  if(['exceptions','finalization','payroll-export','carry-forward','doc-verify','occurrence-summary'].includes(key)){toast('Opening '+key+' (visual)');return;}
  toast('Opening '+key+' (visual)');
}

/* ============================================================
   CONTENT RENDERERS (Zoho-style)
   ============================================================ */
function banner(){return `background:linear-gradient(120deg,#12351f,#0c2718);`}
/* ---- HOME / MY SPACE ---- */
function profileCard(){
  return `<div class="pcard">
    <div class="pc-top">
      <div class="pc-av">MU</div>
      <div class="pc-name">Muneer | GS IT</div>
      <div class="pc-desig">General Manager</div>
      <div class="pc-in">In</div>
      <div class="pc-timer" id="pcTimer"><span class="seg">02</span><span class="cln">:</span><span class="seg">09</span><span class="cln">:</span><span class="seg">41</span></div>
      <button class="btn danger" style="width:100%;justify-content:center" onclick="togglePunch2(this)">Check-out</button>
    </div>
    <div class="pc-block"><div class="pc-lbl">Reportees · ${REPORTEES.length}</div>
      ${REPORTEES.map(r=>`<div class="lrow" style="padding:8px 0"><div class="avatar" style="width:30px;height:30px;font-size:11px">${initials(r.n)}</div><div><div class="li-t" style="font-size:12.5px">${r.n}</div><div class="li-s" style="color:${r.st==='In'?'var(--g)':'var(--muted)'}">${r.st}</div></div></div>`).join('')}
    </div>
  </div>`;
}
function togglePunch2(btn){if(btn.textContent.trim()==='Check-out'){btn.textContent='Check-in';btn.className='btn ok';btn.style.width='100%';btn.style.justifyContent='center';toast('Checked out (visual)');}else{btn.textContent='Check-out';btn.className='btn danger';btn.style.width='100%';btn.style.justifyContent='center';toast('Checked in (visual)');}}
function myOverview(){
  const html=`<div class="psplit">
    <div>${profileCard()}</div>
    <div class="stack">
      ${card('',`<div class="tabs" style="margin:0 0 4px"><div class="tab active">Activities</div><div class="tab" onclick="navTab('dashboard')">Dashboard</div><div class="tab" onclick="toast('Profile (visual)')">Profile</div><div class="tab" onclick="navModule('leave','my','summary')">Leave</div><div class="tab" onclick="navModule('attendance','my','summary')">Attendance</div></div>
        <div class="lrow"><div class="avatar" style="width:36px;height:36px">KP</div><div><div class="li-t">Krishnapriya PS made a request for <b>Leave</b></div><div class="li-s">Awaiting your approval</div></div><div class="li-r"><button class="btn sm" onclick="navModule('home','team','approvals')">Review</button></div></div>
        <div class="lrow"><div class="avatar" style="width:36px;height:36px">SU</div><div><div class="li-t">Sruthi Unnikrishnan checked in <b>late</b></div><div class="li-s">09:45 AM · General shift</div></div><div class="li-r muted" style="font-size:12px">Today</div></div>
      `,{sub:''})}
      ${card('Work Schedule',`<div class="muted" style="font-size:12.5px;margin-bottom:4px">26-Jul-2026 → 01-Aug-2026 · General [ 8:00 AM – 8:00 PM ]</div>
        <div class="wk-strip">${ATT_WEEK.map(w=>`<div class="wk-day ${w.today?'today':''}"><div class="wk-dot"></div><div class="wk-dnum">${w.d} ${w.today?'<b>'+w.n+'</b>':w.n}</div>${w.st?`<div class="wk-st" style="color:${w.cls==='g'?'var(--g)':w.cls==='a'?'var(--a)':'var(--muted)'}">${w.st}</div>`:''}${w.hrs?`<div class="wk-hrs">${w.hrs}</div>`:''}</div>`).join('')}</div>`)}
      ${card('Upcoming Holidays',`<div class="row">${HOL_UP.map(h=>`<div class="card" style="flex:1"><div class="card-b" style="padding:14px"><div class="fw6" style="font-size:13px">${h.n}</div><div class="muted" style="font-size:12px;margin-top:3px">${ic('calendar')} ${h.d}</div></div></div>`).join('')}</div>`,{actions:`<button class="btn sm ghost" onclick="navModule('leave','holidays','list')">View all</button>`})}
    </div>
  </div>`;
  return {html,mount:startPcTimer};
}
const HOL_UP=[{n:'Thiruvonam',d:'26-Aug-2026, Wed'},{n:'Mahatma Gandhi Jayanthi',d:'02-Oct-2026, Fri'},{n:'Vijayadasami',d:'21-Oct-2026, Wed'}];
function myDashboard(){
  return `<div class="grid g-4" style="margin-bottom:16px">
    ${kpi({icon:'clock',acc:'g',val:'01:59',lbl:'Worked today'})}
    ${kpi({icon:'check',acc:'g',val:'4',lbl:'Present this week'})}
    ${kpi({icon:'wallet',acc:'b',val:'14',lbl:'Earned leave balance'})}
    ${kpi({icon:'alert',acc:'a',val:'0',lbl:'Occurrences (12 mo)'})}
  </div>
  <div class="row">
    <div style="flex:1.4">${card('My leave balances',LV_CARDS.slice(0,4).map(b=>`<div style="margin-bottom:13px"><div class="mini-stat"><span>${b.t}</span><b style="color:${b.ac||'inherit'}">${b.avail===null?'—':b.avail} available</b></div>${bar(b.avail===null?0:Math.max(0,Math.min(100,b.avail/20*100)))}</div>`).join(''),{actions:`<button class="btn sm ghost" onclick="navModule('leave','my','summary')">Leave tracker</button>`})}</div>
    <div style="flex:1">${card('This month',`<div class="grid g-2" style="gap:12px"><div><div class="k-val" style="font-size:22px">20</div><div class="muted">Present</div></div><div><div class="k-val" style="font-size:22px;color:var(--a)">2</div><div class="muted">Late</div></div><div><div class="k-val" style="font-size:22px;color:var(--b)">1</div><div class="muted">Leave</div></div><div><div class="k-val" style="font-size:22px">168.5</div><div class="muted">Net hrs</div></div></div>`)}</div>
  </div>`;
}
function myCalendar(){return calGrid(attStatus)+calLegend([{c:'var(--g)',l:'Present'},{c:'var(--a)',l:'Late / Regularize'},{c:'var(--b)',l:'Leave'},{c:'var(--p)',l:'WFH / Holiday'},{c:'var(--gray)',l:'Weekly Off'}]);}
/* ---- HOME / TEAM ---- */
function teamReportees(){
  return `<div class="toolbar"><div class="fw6" style="font-size:15px">Muneer | GS IT</div>
    <div style="margin-left:auto" class="hb"><div class="vtoggle"><button class="on" title="Direct">Direct 4</button><button title="All">All 4</button></div>
    <button class="iconbtn" onclick="toast('Search (inert)')">${ic('inbox')}</button><button class="iconbtn" onclick="toast('Filter (inert)')">${ic('filter')}</button></div></div>
    <div class="rp-grid">${REPORTEES.map(r=>`<div class="rp-card"><div class="avatar">${initials(r.n)}</div><div style="flex:1"><div class="rp-n">${r.id} · ${r.n}</div><div class="rp-d">${r.d}</div><div style="color:${r.st==='In'?'var(--g)':'var(--muted)'};font-weight:600;font-size:12.5px">${r.st}</div></div><button class="iconbtn" style="width:30px;height:30px" onclick="toast('Contact (inert)')">${ic('bell')}</button></div>`).join('')}</div>`;
}
function teamApprovals(){return VIEWS['approvals']();}
function teamEx(){return tableCard('Ex-Employees',['Employee','Designation','Relieved on','Reason'],[['9518070 · Vishnu S','Sales Executive','30-Jun-2026','Resignation'],['9518052 · Anita R','Designer','15-May-2026','End of contract']].map(r=>`<tr><td>${personCell(r[0].split(' · ')[1],r[0].split(' · ')[0])}</td><td>${r[1]}</td><td>${r[2]}</td><td>${bdg('s-gray',r[3])}</td></tr>`).join(''));}
/* ---- HOME / ORGANIZATION ---- */
function orgOverview(){
  const svc=[['umbrella','Leave Tracker','#2f6fd6',()=>navModule('leave')],['clock2','Time Tracker','#c6851b',()=>toast('Time Tracker (out of scope)')],['attendance','Attendance','#d5493f',()=>navModule('attendance')],['file','Files','#2f6fd6',()=>toast('Files (out of scope)')]];
  window.__svc=svc;
  return `<div class="card" style="overflow:hidden;margin-bottom:18px"><div style="height:120px;${banner()}"></div>
    <div class="card-b" style="display:flex;gap:20px;flex-wrap:wrap;margin-top:-46px">
      <div class="pcard" style="width:290px;flex:none">
        <div class="pc-top"><div class="pc-av" style="background:#fff;color:var(--brand);border:1px solid var(--line)">GS</div>
          <div class="pc-name">GLOBAL SURF IT PVT LTD</div><div class="pc-desig">Kerala, India</div>
          <div style="margin-top:10px" class="muted">${ic('plug')} globalsurf.in</div></div>
        <div class="pc-block"><div class="pc-lbl">Quick Links</div><div class="hb muted">${ic('users')} Employees Contact Information</div></div>
      </div>
      <div style="flex:1;min-width:260px;background:#fff;border:1px solid var(--line);border-radius:14px;padding:18px">
        <div class="tabs" style="margin-bottom:16px"><div class="tab active">Services</div><div class="tab" onclick="toast('Location (visual)')">Location</div></div>
        <div class="grid g-2">${svc.map((s,i)=>`<div class="card" style="cursor:pointer" onclick="window.__svc[${i}][3]()"><div class="card-b" style="display:flex;align-items:center;gap:14px;padding:16px"><div style="width:40px;height:40px;border-radius:11px;background:${s[2]}18;color:${s[2]};display:grid;place-items:center">${ic(s[0])}</div><div class="fw6">${s[1]}</div></div></div>`).join('')}</div>
      </div>
    </div></div>`;
}
function orgAnnouncements(){return card('Announcements',`<div class="lrow"><div class="li-ic" style="background:var(--brand-050);color:var(--brand)">${ic('bell')}</div><div><div class="li-t">Ramadan schedule effective 01-Mar-2026</div><div class="li-s">Reduced hours 09:00–15:00 for all Dubai staff</div></div></div><div class="lrow"><div class="li-ic" style="background:var(--g-bg);color:var(--g)">${ic('gift')}</div><div><div class="li-t">Onam holiday list published</div><div class="li-s">Kochi branch · restricted festive day applies</div></div></div>`);}
function orgPolicies(){return tableCard('Policies',['Policy','Version','Effective','Status'],[['Leave & Attendance Policy','2024 · v3','01-Jan-2024','Active'],['Overtime & Comp-Off','2024 · v1','01-Jan-2024','Active'],['Disciplinary Framework','2024 · v2','01-Jan-2024','Active']].map(r=>`<tr><td class="fw6">${r[0]}</td><td>${bdg('s-b',r[1])}</td><td>${r[2]}</td><td>${bdg('s-g',r[3])}</td></tr>`).join(''));}
function orgNewHires(){return tableCard('New Hires',['Employee','Department','Location','Joined'],[['Aisha Khan','Web & Digital','Infopark-Cochin','01-Jul-2026'],['Deepak R.','DevOps','GSIT Dubai','15-Jun-2026']].map(r=>`<tr><td>${personCell(r[0])}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td></tr>`).join(''));}
/* ---- LEAVE ---- */
function lvSummary(){
  return `<div class="toolbar">
    <div><div class="fw6" style="font-size:14px">Leave booked this year: 7 day(s) <span class="muted">| Absent: 0</span></div></div>
    <div class="daterange"><button class="dr-nav" onclick="toast('Prev year')">${ic('chevL')}</button><span class="dr-lbl">01-Jan-2026 – 31-Dec-2026</span><button class="dr-nav" onclick="toast('Next year')">${ic('chevR')}</button></div>
    <button class="btn pri" onclick="openApplyLeave()">${ic('plus')} Apply Leave</button>
  </div>
  <div class="lv-grid" style="margin-bottom:18px">${LV_CARDS.map(b=>`<div class="lv-card"><div class="lv-t">${b.t}</div><div class="lv-ic" style="background:${b.bg};color:${b.fg}">${ic(b.ic)}</div><div class="lv-row"><span class="lk">Available</span><span class="lval" style="color:${b.ac||'inherit'}">${b.avail===null?'—':b.avail}</span></div><div class="lv-divider"></div><div class="lv-row"><span class="lk">Booked</span><span class="lval">${b.booked}</span></div></div>`).join('')}</div>
  ${card('Upcoming Leaves & Holidays',HOLIDAYS.slice(0,4).map(h=>`<div class="lrow"><div class="li-ic" style="background:var(--brand-050);color:var(--brand)">${ic('calendar')}</div><div><div class="li-t">${h.n}</div><div class="li-s">${h.d}</div></div><div class="li-r">${bdg('s-p',h.type)}</div></div>`).join(''))}
  <div style="height:16px"></div>
  ${note('warn',`Comp-off ratio/expiry and encashment formula are ${phFlag('HR confirmation pending')} (FRS §28). Card values are illustrative.`)}`;
}
function lvRequests(){return VIEWS['leave-history']();}
function lvComp(){return VIEWS['ot-compoff']();}
function lvTeam(){return VIEWS['team-leave-cal']();}
function lvTeamApprovals(){return VIEWS['approvals']();}
function lvHolidays(){return VIEWS['holidays']();}
/* ---- ATTENDANCE ---- */
function attToolbar(){
  return `<div class="toolbar">
    <div class="daterange"><button class="dr-nav" onclick="toast('Previous week')">${ic('chevL')}</button><span class="dr-lbl">${ATT_VIEW==='calendar'?'Jul 2026':'26-Jul-2026 – 01-Aug-2026'}</span><button class="dr-nav" onclick="toast('Next week')">${ic('chevR')}</button></div>
    <div class="hb" style="margin-left:auto">
      <div class="vtoggle">
        <button class="${ATT_VIEW==='timeline'?'on':''}" title="Timeline" onclick="setAttView('timeline')">${ic('chart')}</button>
        <button class="${ATT_VIEW==='list'?'on':''}" title="List" onclick="setAttView('list')">${ic('grid')}</button>
        <button class="${ATT_VIEW==='calendar'?'on':''}" title="Calendar" onclick="setAttView('calendar')">${ic('calendar')}</button>
      </div>
      <button class="iconbtn" onclick="toast('Filter (inert)')">${ic('filter')}</button>
    </div>
  </div>`;
}
function summaryStrip(){
  const items=[['Payable Days','6'],['Present','4'],['On Duty','0'],['Paid leave','0'],['Holidays','0'],['Weekend','2']];
  return `<div class="summary-strip"><div class="ss-toggle"><button class="on">Days</button><button onclick="toast('Hours view (visual)')">Hours</button></div>
    ${items.map(i=>`<div class="ss-item"><div class="l">${i[0]}</div><div class="v">${i[1]}</div></div>`).join('')}
    <div class="ss-shift">General [ 8:00 AM – 8:00 PM ]</div></div>`;
}
function attList(){
  const rows=ATT_LIST.map(r=>`<tr><td class="fw6">${r.date}</td><td class="mono">${r.in}</td><td class="mono">${r.out}</td><td class="mono">${r.total}</td><td class="mono">${r.pay}</td>
    <td class="mono" style="color:${r.devc==='g'?'var(--g)':r.devc==='r'?'var(--r)':'inherit'}">${r.dev}</td>
    <td>${r.st?`<span class="bdg s-${r.stc}"><span class="d"></span>${r.st}</span>`:''}</td><td>${r.shift}</td><td class="muted">—</td></tr>`).join('');
  return tableCard('',['Date','First In','Last Out','Total Hours','Payable Hours','Overtime/Deviation','Status','Shift(s)','Regularization'],rows);
}
function attTimeline(){
  const axis=['08AM','09AM','10AM','11AM','12PM','01PM','02PM','03PM','04PM','05PM','06PM','07PM','08PM'];
  const rows=ATT_WEEK.map((w,i)=>{
    const r=ATT_LIST[i]; const present=r&&r.in!=='-'; const weekend=r&&r.st==='Weekend';
    let bar='';
    if(present){const s=(i===1?0.14:i===2?0.15:i===3?0.16:0.17),e=(i===1?0.85:i===3?0.86:0.55);
      bar=`<div class="fill" style="left:${s*100}%;right:${(1-e)*100}%;background:${w.cls==='g'?'#7fce9f':'#e0b96a'}"></div><div class="cap" style="left:${s*100}%;background:#1f9d63"></div>${e>0.6?`<div class="cap" style="right:${(1-e)*100}%;background:#d5493f"></div>`:''}`;}
    else if(weekend){bar=`<div class="fill" style="left:2%;right:2%;background:#f0d9a0"></div>`;}
    return `<div class="tl-row"><div class="tl-day"><div class="d">${w.d}</div><div class="n">${w.n}</div></div>
      <div class="tl-time">${r&&r.in!=='-'?r.in:''}</div>
      <div class="tl-track"><div class="base"></div>${bar}</div>
      <div class="tl-time" style="text-align:right">${r&&r.out!=='-'&&r.out?r.out:''}</div>
      <div class="tl-hrs"><div class="h">${r&&r.total!=='-'?r.total:'00:00'}</div><div class="s">Hrs worked</div></div></div>`;
  }).join('');
  return card('',`${rows}<div class="tl-axis">${axis.map(a=>`<span>${a}</span>`).join('')}</div>`,{pad:true});
}
function attCalendar(){
  const {y,m}=calState,first=new Date(y,m,1).getDay(),days=new Date(y,m+1,0).getDate(),prev=new Date(y,m,0).getDate();
  const jul2026 = (y===2026&&m===6);
  const spec={1:{t:'Earned Leave (First Half)',c:'leave',extra:{t:'0.5 day Present',h:'04:17 Hrs',c:'pres'}},3:{t:'Compensatory Off',c:'comp'}};
  const hoursFor=d=>['08:52','09:02','09:32','09:13','17:34','09:40','09:31','10:14','10:30','09:16','23:30','23:54','04:01','00:01'][d%14];
  let cells='';
  for(let i=0;i<first;i++)cells+=`<div class="cal-cell out att"><div class="dnum">${prev-first+i+1}</div></div>`;
  for(let d=1;d<=days;d++){const dow=new Date(y,m,d).getDay(),wo=(dow===0||dow===6);
    let inner='';
    if(jul2026){
      if(spec[d]){inner=`<span class="att-pill ${spec[d].c}">${spec[d].t}</span>`+(spec[d].extra?`<span class="att-pill ${spec[d].extra.c}">${spec[d].extra.t}<div class="ph">${spec[d].extra.h}</div></span>`:'');}
      else if(!wo&&d<=25){inner=`<span class="att-pill pres">Present<div class="ph">${hoursFor(d)} Hrs</div></span>`;}
    } else if(!wo){inner=`<span class="att-pill pres">Present</span>`;}
    cells+=`<div class="cal-cell att ${wo?'wo':''}"><div class="dnum">${d}</div>${inner}</div>`;
  }
  const total=first+days,tail=(7-total%7)%7;for(let i=1;i<=tail;i++)cells+=`<div class="cal-cell out att"><div class="dnum">${i}</div></div>`;
  return `<div class="cal"><div class="cal-grid">${DOW.map(d=>`<div class="cal-dow">${d}</div>`).join('')}${cells}</div></div>`;
}
function attSummary(){
  let body = ATT_VIEW==='list'?attList():ATT_VIEW==='timeline'?attTimeline():attCalendar();
  return attToolbar()+body+(ATT_VIEW==='calendar'?'':summaryStrip());
}
function attReg(){return VIEWS['regularization']();}
function attTeam(){return VIEWS['team-attendance']();}
/* ---- OPERATIONS ---- */
function opsHub(){
  const isAdmin=PERSONAS[PERSONA].admin;
  const secs=OPS_SERVICES.filter(s=>!s.admin||isAdmin);
  return `<div style="margin-bottom:18px"><h1 style="font-size:22px;font-weight:600">Operations</h1><div class="muted" style="font-size:13.5px;margin-top:3px">Management hub — configuration, processing, compliance and payroll output</div></div>
    ${secs.map(s=>`<div class="ops-sec">${s.sec}</div><div class="ops-grid">${s.items.map(it=>`<div class="ops-card" onclick="openService('${it[0]}')"><div class="ops-ic" style="background:${it[3]}18;color:${it[3]}">${ic(it[2])}</div><div class="ops-t">${it[1]}</div></div>`).join('')}</div>`).join('')}`;
}
function opsService(key){
  const svc=SVC_INDEX[key]; if(!svc)return opsHub();
  const view=VIEWS[svc.view]?VIEWS[svc.view]():`<div class="empty">Service unavailable</div>`;
  const inner=typeof view==='string'?view:view.html;
  return `<div style="margin-bottom:14px"><button class="btn sm ghost" onclick="backOps()">${ic('chevL')} Operations</button></div>${inner}`;
}

/* ---- DISPATCH ---- */
const DISPATCH={
  'home/my/overview':myOverview,'home/my/dashboard':myDashboard,'home/my/calendar':myCalendar,
  'home/team/reportees':teamReportees,'home/team/approvals':teamApprovals,'home/team/exemp':teamEx,
  'home/org/overview':orgOverview,'home/org/announcements':orgAnnouncements,'home/org/policies':orgPolicies,'home/org/newhires':orgNewHires,
  'leave/my/summary':lvSummary,'leave/my/requests':lvRequests,'leave/my/comp':lvComp,
  'leave/team/calendar':lvTeam,'leave/team/approvals':lvTeamApprovals,'leave/holidays/list':lvHolidays,
  'attendance/my/summary':attSummary,'attendance/my/regularization':attReg,'attendance/team/summary':attTeam,
};


/* ============ APP INTEGRATION OVERRIDES (later declarations win) ============ */
IC.umbrella = 'M22 12a10 10 0 00-20 0zM12 12v8a2 2 0 004 0';
IC.attendance = IC.clock;

function renderRail() {}
function renderScopeTabs() {}
function renderSubbar() {}
function toggleRail() {}

function __chromeState() {
  const p = PERSONAS[PERSONA];
  const rail = p.modules.map((m) => ({ k: m, label: RAIL_DEF[m][1], icon: RAIL_DEF[m][0], active: m === MODULE }));
  let scopes = [];
  let tabs = [];
  if (MODULE !== 'operations' && MODULE !== 'reports') {
    const cfg = MODCFG[MODULE];
    const avail = p.scopes[MODULE] || [];
    scopes = avail.map((s) => ({ k: s, label: cfg.scopeLabels[s], active: s === SCOPE }));
    tabs = (cfg.tabs[SCOPE] || []).map((t) => ({ k: t, label: cfg.tabLabels[t], badge: t === 'approvals' ? '3' : '', active: t === TAB }));
  }
  return {
    module: MODULE,
    scope: SCOPE,
    tab: TAB,
    ops: OPS,
    rail,
    scopes,
    tabs,
    title: MODULE === 'operations' ? 'Operations' : MODULE === 'reports' ? 'Reports' : '',
    settings: !!p.settings,
  };
}

function renderAll() {
  renderContent();
  window.dispatchEvent(new CustomEvent('la:chrome', { detail: __chromeState() }));
}

function setPersona(p) {
  PERSONA = p;
  OPS = null;
  closeModal();
  navModule('home');
}

window.__laIc = ic;
/* Jump to the screen a URL describes: [module, scope, tab] or ['operations', service]. One render. */
window.laGoto = function (path) {
  const [m, a, b] = path || [];
  closeModal();
  if (m === 'operations' && PERSONAS[PERSONA].modules.includes('operations')) {
    MODULE = 'operations'; SCOPE = null; TAB = null; OPS = a && SVC_INDEX[a] ? a : null;
    renderAll();
  } else if (m && PERSONAS[PERSONA].modules.includes(m)) navModule(m, a, b);
  else navModule('home');
};
window.laInit = function (root, path) {
  window.__laRoot = root;
  PERSONA = (window.__laOrg && window.__laOrg.persona) || 'admin';
  window.laGoto(path);
};
