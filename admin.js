const A={token:"",user:"",repo:"",branch:"main",tab:"products",data:{},shas:{}};
const $=s=>document.querySelector(s);
const esc=x=>String(x??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;",'\'':"&#039;"}[m]));
const money=n=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(n)||0);
const gh=()=>`https://api.github.com/repos/${encodeURIComponent(A.user)}/${encodeURIComponent(A.repo)}`;

function explainStatus(status,stage){
  const map={
    400:"A solicitação enviada ao GitHub é inválida.",
    401:"Token inválido, expirado ou revogado. Gere um novo Fine-grained token.",
    403:"O GitHub recusou o acesso. Confira as permissões do token e se Contents está em Read and write.",
    404:"Repositório, branch ou arquivo não encontrado — ou o token não tem acesso a este repositório.",
    409:"O GitHub encontrou um conflito. Atualize a página e tente novamente.",
    422:"O GitHub não aceitou os dados enviados.",
    429:"Limite temporário de requisições do GitHub atingido. Aguarde e tente novamente."
  };
  return `${map[status]||`GitHub retornou HTTP ${status}.`} Etapa: ${stage}.`;
}

function showLoginMessage(message,type="error",details=""){
  const el=$("#loginMsg");
  el.className=`login-status ${type}`;
  el.innerHTML=`<b>${esc(message)}</b>${details?`<small>${esc(details)}</small>`:""}`;
}

async function api(path,opts={}){
  const headers={Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28",Authorization:`Bearer ${A.token}`,...(opts.headers||{})};
  const r=await fetch(`${gh()}/${path}`,{...opts,headers});
  let d={};try{d=await r.json()}catch{}
  if(!r.ok){
    const e=new Error(d.message||`GitHub HTTP ${r.status}`);
    e.status=r.status;e.githubMessage=d.message||"";e.path=path;throw e;
  }
  return d;
}

function normalizeRepo(){
  let r=A.repo.trim().replace(/^https?:\/\/github\.com\//i,"").replace(/\.git$/i,"").replace(/\/$/,"");
  if(r.includes("/")){const parts=r.split("/").filter(Boolean);if(parts.length===2){if(!A.user)A.user=parts[0];r=parts[1]}}
  return r;
}

async function connect(){
  A.user=$("#ghUser").value.trim();
  A.repo=normalizeRepo();
  A.branch=$("#ghBranch").value.trim()||"main";
  A.token=$("#ghToken").value.trim();
  if(!A.user)return showLoginMessage("Informe o usuário do GitHub.");
  if(!A.repo)return showLoginMessage("Informe o nome do repositório.");
  if(!A.token)return showLoginMessage("Informe o token GitHub.");
  $("#connect").disabled=true;
  $("#connect").textContent="Verificando...";
  showLoginMessage("1/4 — Verificando repositório...","info");
  try{
    const repo=await api("");
    if(repo.name && repo.name.toLowerCase()!==A.repo.toLowerCase())throw new Error("O GitHub retornou outro repositório.");
    if(repo.archived)throw new Error("Este repositório está arquivado no GitHub.");

    showLoginMessage("2/4 — Verificando branch...","info");
    const branch=await api(`branches/${encodeURIComponent(A.branch)}`);
    if(branch.name && branch.name!==A.branch)throw new Error("A branch informada não corresponde à branch encontrada.");

    showLoginMessage("3/4 — Verificando data/settings.json...","info");
    await api(`contents/data/settings.json?ref=${encodeURIComponent(A.branch)}`);

    showLoginMessage("4/4 — Carregando catálogo...","info");
    await loadData();

    if(repo.permissions && repo.permissions.push===false){
      throw new Error("O token consegue ler o repositório, mas não possui permissão de escrita (push). No Fine-grained token, deixe Contents como Read and write.");
    }
    $("#login").classList.add("hidden");
    $("#panel").classList.remove("hidden");
    $("#logout").classList.remove("hidden");
    renderTab();
  }catch(e){
    let msg=e.message||"Não foi possível conectar ao GitHub.";
    if(e.status)msg=`${explainStatus(e.status,e.path?.replace(/^.*?\/contents\//,"conteúdo")||"GitHub API")} ${e.githubMessage&&e.githubMessage!==msg?`Mensagem do GitHub: ${e.githubMessage}`:""}`;
    showLoginMessage(msg,"error",`Usuário: ${A.user} • Repositório: ${A.repo} • Branch: ${A.branch}`);
    A.token="";
  }finally{
    $("#connect").disabled=false;
    $("#connect").textContent="Entrar";
  }
}

$("#connect").onclick=connect;
$("#logout").onclick=()=>location.reload();

async function getFile(path){return api(`contents/${path}?ref=${encodeURIComponent(A.branch)}`)}
async function readJson(path){const f=await getFile(path);const raw=decodeURIComponent(escape(atob(f.content.replace(/\n/g,""))));return {data:JSON.parse(raw),sha:f.sha}}
async function writeJson(path,data,message){const f=await getFile(path);const content=btoa(unescape(encodeURIComponent(JSON.stringify(data,null,2))));return api(`contents/${path}`,{method:"PUT",body:JSON.stringify({message,content,branch:A.branch,sha:f.sha})})}
async function loadData(){const names=["products","categories","themes","settings"];const r=await Promise.all(names.map(n=>readJson(`data/${n}.json`)));A.data=Object.fromEntries(names.map((n,i)=>[n,r[i].data]));A.shas=Object.fromEntries(names.map((n,i)=>[n,r[i].sha]))}
function slug(x){return x.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"")}
async function saveJson(path,key,message){await writeJson(path,A.data[key],message);await loadData();renderTab()}
function renderTab(){const f={products:productsTab,categories:categoriesTab,themes:themesTab,settings:settingsTab}[A.tab];$("#adminContent").innerHTML=f()}
document.querySelectorAll(".side button").forEach(b=>b.onclick=()=>{document.querySelectorAll(".side button").forEach(x=>x.classList.remove("selected"));b.classList.add("selected");A.tab=b.dataset.tab;renderTab()});
function productsTab(){return `<div class="title"><div><h1>Produtos e artes</h1><p>O código da arte será enviado ao WhatsApp.</p></div><button class="primary" onclick="newProduct()">＋ Novo produto</button></div>${A.data.products.map(p=>{const c=A.data.categories.find(x=>x.id===p.categoryId);return `<div class="row"><img src="${esc(p.image||'assets/products/placeholder.svg')}" onerror="this.src='assets/products/placeholder.svg'"><div class="row-info"><b>${esc(p.name)}</b><small>${esc(p.code)} • ${esc(c?.name||'Sem categoria')}</small><small>${p.active!==false?'Visível':'Oculto'} • ${money(p.price)}</small></div><button onclick="toggleProduct('${esc(p.id)}')">${p.active!==false?'Ocultar':'Mostrar'}</button><button onclick="editProduct('${esc(p.id)}')">Editar</button><button class="danger" onclick="deleteProduct('${esc(p.id)}')">🗑</button></div>`}).join("")}`}
function categoriesTab(){return `<div class="title"><div><h1>Categorias</h1><p>Ocultar uma categoria não apaga os produtos.</p></div><button class="primary" onclick="addCategory()">＋ Nova categoria</button></div>${A.data.categories.map(x=>`<div class="row"><div class="row-info"><b>${esc(x.name)}</b><small>${x.active?'Visível':'Oculta'}</small></div><button onclick="toggleCategory('${esc(x.id)}')">${x.active?'Ocultar':'Mostrar'}</button><button onclick="renameCategory('${esc(x.id)}')">Editar</button><button class="danger" onclick="deleteCategory('${esc(x.id)}')">🗑</button></div>`).join("")}`}
function themesTab(){return `<div class="title"><div><h1>Temas</h1><p>Crie temas como Esportes, Dia dos Professores etc.</p></div><button class="primary" onclick="addTheme()">＋ Novo tema</button></div>${A.data.themes.map(x=>`<div class="row"><div class="row-info"><b>${esc(x.name)}</b><small>${x.active?'Visível':'Oculto'}</small></div><button onclick="toggleTheme('${esc(x.id)}')">${x.active?'Ocultar':'Mostrar'}</button><button onclick="renameTheme('${esc(x.id)}')">Editar</button><button class="danger" onclick="deleteTheme('${esc(x.id)}')">🗑</button></div>`).join("")}`}
function settingsTab(){const s=A.data.settings;return `<div class="title"><div><h1>Configurações do catálogo</h1><p>Edite textos, cores, WhatsApp e o que aparece no catálogo.</p></div><button class="primary" onclick="saveSettings()">💾 Salvar</button></div><div class="form"><div class="two"><label>Nome<input id="sName" value="${esc(s.siteName)}"></label><label>WhatsApp<input id="sWa" value="${esc(s.whatsapp)}"></label></div><label>Texto pequeno<input id="sEyebrow" value="${esc(s.eyebrow)}"></label><label>Título principal<input id="sTitle" value="${esc(s.heroTitle)}"></label><label>Texto de apresentação<textarea id="sHero">${esc(s.heroText)}</textarea></label><label>Placeholder da busca<input id="sSearch" value="${esc(s.searchPlaceholder)}"></label><label>Rodapé<input id="sFooter" value="${esc(s.footerText)}"></label><div class="setting-colors"><label>Rosa<input id="sPink" type="color" value="${s.primary}"></label><label>Turquesa<input id="sTeal" type="color" value="${s.secondary}"></label><label>Amarelo<input id="sYellow" type="color" value="${s.accent}"></label></div><div class="switches"><label><input id="sSearchOn" type="checkbox" ${s.showSearch!==false?'checked':''}> Mostrar busca</label><label><input id="sThemesOn" type="checkbox" ${s.showThemes!==false?'checked':''}> Mostrar filtro de temas</label></div><p class="admin-note">O número do WhatsApp deve ser informado com DDI e DDD, somente números. Ex.: 5565999999999.</p></div>`}
function newProduct(){editProductForm({id:`p-${Date.now()}`,name:"",code:"",description:"",categoryId:A.data.categories.find(x=>x.active)?.id||"",themeId:"",image:"assets/products/placeholder.svg",active:true,price:35,tiers:[{min:2,price:32},{min:11,price:27}],isNew:true})}function editProduct(id){const p=A.data.products.find(x=>x.id===id);if(p)editProductForm({...p,isNew:false})}
function editProductForm(p){const cats=A.data.categories.map(x=>`<option value="${esc(x.id)}" ${p.categoryId===x.id?'selected':''}>${esc(x.name)}</option>`).join("");const themes=A.data.themes.map(x=>`<option value="${esc(x.id)}" ${p.themeId===x.id?'selected':''}>${esc(x.name)}</option>`).join("");const tiers=(p.tiers||[]).map(t=>`<div class="tier"><input class="tier-min" type="number" min="1" value="${Number(t.min)}"><span>unid. ou mais</span><input class="tier-price" type="number" min="0" step="0.01" value="${Number(t.price)}"><button type="button" onclick="this.parentElement.remove()">🗑</button></div>`).join("");$("#adminContent").innerHTML=`<div class="title"><div><h1>${p.isNew?'Novo produto':'Editar produto'}</h1><p>Você pode trocar a foto sempre que quiser.</p></div><button class="outline" onclick="renderTab()">← Voltar</button></div><div class="form"><div class="two"><label>Nome do produto<input id="pName" value="${esc(p.name)}"></label><label>Código da arte<input id="pCode" value="${esc(p.code)}"></label></div><div class="two"><label>Categoria<select id="pCat">${cats}</select></label><label>Tema<select id="pTheme"><option value="">Sem tema</option>${themes}</select></label></div><label>Descrição<textarea id="pDesc">${esc(p.description)}</textarea></label><div class="two"><label>Preço para 1 unidade<input id="pPrice" type="number" min="0" step="0.01" value="${Number(p.price)||0}"></label><label>Foto da arte<input id="pFile" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml"></label></div><img class="upload-preview" src="${esc(p.image||'assets/products/placeholder.svg')}" onerror="this.src='assets/products/placeholder.svg'"><div class="tiers"><b>Preços por quantidade</b>${tiers}<button type="button" onclick="addTier()">＋ Adicionar faixa</button></div><label><input id="pActive" type="checkbox" ${p.active!==false?'checked':''}> Mostrar este produto no catálogo</label><button class="primary" onclick="saveProduct('${esc(p.id)}',${p.isNew})">💾 Salvar produto</button></div>`}
function addTier(){const d=document.createElement("div");d.className="tier";d.innerHTML='<input class="tier-min" type="number" min="1" value="2"><span>unid. ou mais</span><input class="tier-price" type="number" min="0" step="0.01" value="0"><button type="button" onclick="this.parentElement.remove()">🗑</button>';document.querySelector('.tiers').appendChild(d)}
async function uploadImage(file){const ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg';const path=`assets/products/${Date.now()}-${slug(file.name).slice(0,40)||'arte'}.${ext}`;const bytes=new Uint8Array(await file.arrayBuffer());let binary="";for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));const r=await api(`contents/${path}`,{method:'PUT',body:JSON.stringify({message:`Adicionar imagem ${file.name}`,content:btoa(binary),branch:A.branch})});return r.content.path}
async function saveProduct(id,isNew){try{const old=A.data.products.find(x=>x.id===id);const code=$("#pCode").value.trim();if(!code)throw new Error('Informe o código da arte.');const duplicate=A.data.products.find(x=>x.code.toLowerCase()===code.toLowerCase()&&x.id!==id);if(duplicate)throw new Error('Este código de arte já está sendo usado.');let image=old?.image||'assets/products/placeholder.svg';const file=$("#pFile").files[0];if(file)image=await uploadImage(file);const tiers=[...document.querySelectorAll('.tier')].map(d=>({min:Number(d.querySelector('.tier-min').value),price:Number(d.querySelector('.tier-price').value)})).filter(t=>t.min>0&&t.price>=0).sort((a,b)=>a.min-b.min);const p={id,name:$("#pName").value.trim(),code,description:$("#pDesc").value.trim(),categoryId:$("#pCat").value,themeId:$("#pTheme").value,image,active:$("#pActive").checked,price:Number($("#pPrice").value)||0,tiers};if(!p.name)throw new Error('Informe o nome do produto.');if(isNew)A.data.products.push(p);else A.data.products=A.data.products.map(x=>x.id===id?p:x);await writeJson('data/products.json',A.data.products,isNew?'Adicionar produto':'Editar produto');await loadData();renderTab();alert('Produto salvo e enviado para o GitHub.')}catch(e){alert(e.status?`${explainStatus(e.status,'salvar produto')}\n\n${e.githubMessage||e.message}`:e.message)}}
async function toggleProduct(id){try{const p=A.data.products.find(x=>x.id===id);p.active=p.active===false;await saveJson('data/products.json','products','Alterar visibilidade do produto')}catch(e){alert(e.status?`${explainStatus(e.status,'alterar produto')}\n\n${e.githubMessage||e.message}`:e.message)}}
async function deleteProduct(id){if(!confirm('Excluir este produto?'))return;try{A.data.products=A.data.products.filter(x=>x.id!==id);await saveJson('data/products.json','products','Excluir produto')}catch(e){alert(e.status?`${explainStatus(e.status,'excluir produto')}\n\n${e.githubMessage||e.message}`:e.message)}}
async function addCategory(){const n=prompt('Nome da categoria:');if(!n?.trim())return;const id=slug(n);if(A.data.categories.some(x=>x.id===id))return alert('Essa categoria já existe.');A.data.categories.push({id,name:n.trim(),active:true});await saveJson('data/categories.json','categories','Adicionar categoria')}
async function renameCategory(id){const x=A.data.categories.find(x=>x.id===id),n=prompt('Novo nome:',x.name);if(!n?.trim())return;x.name=n.trim();await saveJson('data/categories.json','categories','Editar categoria')}
async function toggleCategory(id){const x=A.data.categories.find(x=>x.id===id);x.active=!x.active;await saveJson('data/categories.json','categories','Alterar visibilidade da categoria')}
async function deleteCategory(id){if(!confirm('Excluir categoria? Os produtos dela continuarão no catálogo, mas ficarão sem categoria.'))return;A.data.categories=A.data.categories.filter(x=>x.id!==id);A.data.products.forEach(p=>{if(p.categoryId===id)p.categoryId=''});await writeJson('data/categories.json',A.data.categories,'Excluir categoria');await writeJson('data/products.json',A.data.products,'Atualizar produtos após excluir categoria');await loadData();renderTab()}
async function addTheme(){const n=prompt('Nome do tema:');if(!n?.trim())return;const id=slug(n);if(A.data.themes.some(x=>x.id===id))return alert('Esse tema já existe.');A.data.themes.push({id,name:n.trim(),active:true});await saveJson('data/themes.json','themes','Adicionar tema')}
async function renameTheme(id){const x=A.data.themes.find(x=>x.id===id),n=prompt('Novo nome:',x.name);if(!n?.trim())return;x.name=n.trim();await saveJson('data/themes.json','themes','Editar tema')}
async function toggleTheme(id){const x=A.data.themes.find(x=>x.id===id);x.active=!x.active;await saveJson('data/themes.json','themes','Alterar visibilidade do tema')}
async function deleteTheme(id){if(!confirm('Excluir tema? Os produtos dele ficarão sem tema.'))return;A.data.themes=A.data.themes.filter(x=>x.id!==id);A.data.products.forEach(p=>{if(p.themeId===id)p.themeId=''});await writeJson('data/themes.json',A.data.themes,'Excluir tema');await writeJson('data/products.json',A.data.products,'Atualizar produtos após excluir tema');await loadData();renderTab()}
async function saveSettings(){try{const s={siteName:$("#sName").value.trim()||'Techne',eyebrow:$("#sEyebrow").value.trim(),heroTitle:$("#sTitle").value.trim(),heroText:$("#sHero").value.trim(),searchPlaceholder:$("#sSearch").value.trim(),footerText:$("#sFooter").value.trim(),whatsapp:$("#sWa").value.replace(/\D/g,''),primary:$("#sPink").value,secondary:$("#sTeal").value,accent:$("#sYellow").value,showSearch:$("#sSearchOn").checked,showThemes:$("#sThemesOn").checked};await writeJson('data/settings.json',s,'Atualizar configurações do catálogo');await loadData();renderTab();alert('Configurações salvas.')}catch(e){alert(e.status?`${explainStatus(e.status,'salvar configurações')}\n\n${e.githubMessage||e.message}`:e.message)}}
