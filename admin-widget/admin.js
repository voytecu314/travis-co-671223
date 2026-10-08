(function () {

const config = window.__ADMIN_WIDGET_CONFIG__ || {};
const API_BASE = config.apiBase;
const LOGIN_USER = config.loginUser;
const TEXT_USER = config.textUser;

if (!API_BASE || !LOGIN_USER || !TEXT_USER) {
   console.warn('[admin-widget] window.__ADMIN_WIDGET_CONFIG__ missing required fields - widget disabled.');
   return;
}

// Set Language
let chosenLanguage = (document.documentElement.lang || 'en').substring(0,2);

function getNodeByAddress (address) {

    const addressArray = address.split('.');
    
    return addressArray.reduce((node, index)=>{
        const childNode = node.childNodes[index];
        return childNode;
    },document.body);

}

function fetchLanguage (language=chosenLanguage) {

    fetch(API_BASE+'/cms/get-text-nodes/'+TEXT_USER+'/languages/'+language)
    .then(res=>res.json()).then(data=>{
        
        data && data.forEach( textNode => getNodeByAddress(textNode.nodeAddress).textContent = textNode.textContent[language] );

        }).catch(console.log);
}

fetchLanguage();

// Admin Panel

const adminLogin = document.getElementById("admin-form");
const key = document.getElementById("key")
let mode = "login"; 

function toggleKey(el) {
   adminLogin.classList.toggle("disappear");
   key.classList.toggle("disappear");

   mode = "login";

   resetFormUI();

   if (el.id === 'key') {
      adminLogin["password"].focus();
   }
}

function resetFormUI() {
   adminLogin["new_password"].classList.add("disappear");
   adminLogin["repeat_new_password"].classList.add("disappear");

   document.getElementById("chngPsw").classList.remove("disappear");

   document.getElementById("chngPsw").textContent = "Zmień hasło";
}

function managePassword(el) {
   const newPass = adminLogin["new_password"];
   const repeatPass = adminLogin["repeat_new_password"];
   repeatPass.value = '';

   const isHidden = newPass.classList.contains("disappear");

   if (el.id === "chngPsw") {
      mode = isHidden ? "change" : "login";
   }

   if (el.id === "addPsw") {
      mode = isHidden ? "add" : "login";
   }

   newPass.classList.toggle("disappear");
   repeatPass.classList.toggle("disappear");

   document.getElementById("chngPsw").classList.toggle("disappear", mode === "add");

   if (isHidden) {
   el.textContent = "Wróć do logowania";
   } else {
      el.textContent = el.id === "chngPsw" ? "Zmień hasło" : "Dodaj hasło";
   }
   adminLogin["password"].focus();
}

function login(e) {
   e.preventDefault();
   const data = {
      action: null,
      user: LOGIN_USER,
      password: adminLogin["password"].value,
      new_password: adminLogin["new_password"].value,
   }

   if(mode !== 'login' && adminLogin["repeat_new_password"].value !== data.new_password) {
      console.log('Password confirmaton failed');
      return;
   }    
   if(mode !== 'login' && data.new_password.length < 8) {
      console.log('New Password is to short');
      return;      
   }

   if (mode === "login") {
      data.action = 'login';

      fetch(
         API_BASE+'/cms/admin/login/'+data.user,
         {
            method: 'POST',
            headers: {
               "Content-Type": "application/json",
            },
            body: JSON.stringify(data),
         }
      )
      .then(res=>res.json())
      .then(({jwtToken, auth, message})=>{
         if(jwtToken && auth) {

               localStorage.setItem('jwtToken',jwtToken);

               makeBodyTextEditable();

               document.getElementById("admin-login-wrapper").classList.toggle("disappear");
               document.getElementById("admin-edit-wrapper").classList.toggle("disappear");

               let tokenSeconds = JSON.parse(atob(localStorage.getItem('jwtToken').split('.')[1])).exp -JSON.parse(atob(localStorage.getItem('jwtToken').split('.')[1])).iat;
               const secondsLeft = document.getElementById('token-time-seconds');
               secondsLeft.textContent = tokenSeconds;


               setInterval(()=>{
                  secondsLeft.textContent = parseInt(secondsLeft.textContent) - 1;
                  secondsLeft.textContent=='0' ? window.location.reload() : null;
               },1000);
         } else {
               const info = document.getElementById('login-msg');
               info.textContent=message;
               info.style.color = 'red';
         }
      })
      .catch(console.log);

      console.log("LOGIN ONLY","\n" ,data);
    }

   if (mode === "change") {
      data.action = 'change';

      fetch(
         API_BASE+'/cms/admin/password/change',
         {
            method: 'POST',
            headers: {
               "Content-Type": "application/json",
            },
            body: JSON.stringify(data),
         }
      )
      .then(res=>res.json())
      .then(console.log)
      .catch(console.log);
      

      console.log("CHANGE PASSWORD","\n" ,data);
   }
}

function makeBodyTextEditable() {

    document.addEventListener("keydown", function(e) {
        if (e.key == 'Enter') {
        e.preventDefault();
        }
    });
        
    function isTextNode (node) {

        return node.nodeType === 3 && node.textContent.trim().length > 1;

    }

    function wrapTextContent (element) {
        
        const nodes = element.childNodes;

        for(let node of nodes) {

            if( isTextNode(node) ) { 

                const span = document.createElement('span');
                node.after(span);
                span.appendChild(node);  
                span.contentEditable = 'true';
                span.classList.add('admin-edit');
                span.dataset.textEdited = 'false';
                span.addEventListener('input',()=>{if(span.dataset.textEdited==='false') span.dataset.textEdited='true'});
            }

            if( (node.nodeType === 1) && !node.classList.contains("no-edit") ) {
                wrapTextContent(node);
            } 
        }
    }

    wrapTextContent(document.body);
}

let textNodesAfterSave = [];

function getTextNodesAddressesAfterSave (element,index='',tagRoute='BODY') { 
    const nodes = element.childNodes;

    for (let i = 0; i < nodes.length; i++) {
        let node = nodes[i];
        if( node.childNodes.length && !node.classList.contains("no-edit") ) getTextNodesAddressesAfterSave(node,index+i+'.',tagRoute+'>'+node.tagName);
        else if(node.parentElement.dataset.textEdited==='true' && node.nodeType === 3 && node.textContent.trim().length > 1) {
            const textNode = {
                numberOfOrder: textNodesAfterSave.length,
                nodeAddress: (index+i).slice(0,-2),
                textContent: {
                    [chosenLanguage]: node.textContent},
                tagRoute: tagRoute.slice(0,-5),
            }
            textNodesAfterSave.push(textNode);
        }
    }

    return textNodesAfterSave;

}


adminLogin.addEventListener('submit', (e) => login(e));

document.getElementById('admin-save-text').addEventListener('click',()=>{
    textNodesAfterSave = [];
    const jwtToken = localStorage.getItem('jwtToken');
    const textNodesArray =  getTextNodesAddressesAfterSave(document.body);
    const language = chosenLanguage;
    const user = TEXT_USER;

    fetch(API_BASE+'/cms/send-text-nodes', {
                method: 'POST',
                headers: {
                    'Content-Type':'application/json'
                },
                body: JSON.stringify({
                    jwtToken,
                    user,
                    language,
                    textNodesArray,
                }),
            })
            .then(res=>res.json())
            .then(res => {
                document.getElementById('panel-title').textContent = res.message;
                setTimeout(()=>document.getElementById('panel-title').textContent = '',5*1000)
                console.log(res);
            })
            .catch(console.log);
});
document.getElementById('admin-reset-text').addEventListener('click',()=>fetchLanguage(chosenLanguage));
document.getElementById('admin-exit').addEventListener('click',()=>{location.reload(); localStorage.removeItem('jwtToken')});

// The markup uses inline onclick="toggleKey(this)" / "managePassword(this)"
window.toggleKey = toggleKey;
window.managePassword = managePassword;

})();