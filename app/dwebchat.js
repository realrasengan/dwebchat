let chats=[];
let inputs=[];

document.addEventListener('DOMContentLoaded', ()=>{
  const messageInput = document.getElementById('messageInput');
  const sendButton = document.getElementById('sendButton');
  sendButton.addEventListener('click', () => { handleMessage(); });
  messageInput.addEventListener('keydown', (e) => { 
    if (e.key === 'Enter') {
      handleMessage();
    }
  });
  const sidebarToggle = document.getElementById('sidebarToggle');
  const createWindowButton = document.getElementById('createWindow');
  const sidebar = document.getElementById('dwebchatSidebar');
  let sidebarToggleStatus=true;

  sidebarToggle.addEventListener('click', () => {
    sidebar.style.flex = sidebarToggleStatus ? 0 : 4;
    sidebar.style.maxWidth= sidebarToggleStatus ? '12px' : '100%';
    sidebarToggleStatus=sidebarToggleStatus?false:true;
    sidebarToggle.textContent = sidebarToggle.textContent === "◀" ? "▶" : "◀";
    createWindowButton.style.position = createWindow.style.position === 'absolute' ? 'fixed' : 'absolute';
  });

  window.electronAPI.receive((event,method,msg)=> {
    switch(method) {
      case 'msg':
        if(msg.verified) {
          addLine(msg.message,msg.name);
        }
        else {
          addLine("Received "+JSON.stringify(msg),"@status");
        }
        break;
      case 'console':
        addLine(msg,"@status");
        break;
    }
  });

  createWindowButton.addEventListener('click', function() {
    document.getElementById('prompt').style.display = 'flex';
    document.getElementById('promptInput').focus();
  });
  document.getElementById('promptInput').addEventListener('keydown', (e)=>{ 
    if(e.key==='Enter')
      document.getElementById('promptOk').click();
  });
  document.getElementById('promptOk').addEventListener('click', function() {
    const name = document.getElementById('promptInput').value;
    if (name) {
      if(!chats[name.toLowerCase()])
        chats[name.toLowerCase()]=[];
      let tab = addName(name.toLowerCase(), sidebar);
      setActive(tab);
    }
    promptClear();
  });
  document.getElementById('promptCancel').addEventListener('click', function() {
    promptClear();
  });
  addName("@status",sidebar);
  messageInput.currentName="@status";  
  addLine("Type 'help' for Help","@status");
});

function promptClear() {
  document.getElementById('prompt').style.display = 'none';
  document.getElementById('promptInput').value = '';
}
function dwebchat(msg) {
  window.electronAPI.send(msg);
}
function notice(name) {
  document.querySelectorAll('.message-name').forEach(n => {
    if (n.textContent === name) {
      n.classList.add('pending');
    }
  });
}
function setActive(nameElement) {
  const messageArea = document.getElementById('messageArea');
  const messageInput = document.getElementById('messageInput');
  if(messageInput.currentName) {
    inputs[messageInput.currentName]=messageInput.value;
  }
  messageInput.currentName=nameElement.textContent;
  if(inputs[messageInput.currentName])
    messageInput.value=inputs[messageInput.currentName];
  else
    messageInput.value='';
  messageArea.innerHTML="";
  document.querySelectorAll('.message-name').forEach(n => n.classList.remove('active', 'pending'));
  nameElement.classList.add('active');
  nameElement.classList.remove('pending');
  for(let c=0;c<chats[nameElement.textContent].length;c++) {
    addLineQuiet(chats[nameElement.textContent][c].msg,chats[nameElement.textContent][c].from);
  }
  messageInput.focus();
}
function handleMessage() {
  const messageInput = document.getElementById('messageInput');
  const sendButton = document.getElementById('sendButton');

  if(!messageInput.currentName)
    return;
  if(messageInput.value.length==0)
    return;
  const name = messageInput.currentName;
  const msg = messageInput.value.trim();
  if(name==="@status") {
    if(msg) {
      let splits=msg.split(' ');
      switch(splits[0].toLowerCase()) {
        case 'help':
          if(splits[1]) {
            switch(splits[1].toLowerCase()) {
              case 'block':
                addLine("**** Help BLOCK ****","@status");
                addLine("Usage: BLOCK add IP","@status");
                addLine("       BLOCK del IP","@status");
                addLine("       BLOCK list","@status");
                addLine("Example: BLOCK add 6.6.6.6","@status");
                addLine("Block will prevent an IP from being able to touch the server.","@status");
                addLine("**** End of Help ****","@status");
                break;
              case 'quit':
                addLine("**** Help QUIT ****","@status");
                addLine("Usage: QUIT","@status");
                addLine("Example: QUIT","@status");
                addLine("Quit will exit the program.","@status");
                addLine("**** End of Help ****","@status");
                break;
              default:
                addline("*** Error please type 'help' for help.","@status");
                break;
            }
          } else {
            addLine("**** Help ****","@status");
            addLine("BLOCK - Block IPs","@status");
            addLine("QUIT  - Exit","@status");
            addLine("Type HELP CMD to get more help.","@status");
            addLine("**** End of Help ****","@status");
          }
          break;
        case 'block':
          if(splits[1]) {
            switch(splits[1].toLowerCase()) {
              case 'add':
              case 'addbyname':
              case 'delbyname':
              case 'del':
                if(splits[2]) {
                  dwebchat({name:"@status",msg});
                }
                break;
              case 'list':
                dwebchat({name:"@status",msg});
                break;
              default:
                addLine("*** Error please type 'help block' for help.","@status");
                break;
            }
          }
          break;
        case 'quit':
          window.close();
          break;
        default:
          break;
      }
    } else {
      console.error('Message is empty!');
    }
  }
  else {
    if(msg) {
      dwebchat({name,msg});
      chats[name].push({from:"..me..",msg});
      addLineQuiet(msg,"..me..")
      messageInput.value = '';
    } else {
      console.error('Message is empty!');
    }
  }
  messageInput.value = '';
}
function addLine(msg, sender) {
  const messageInput = document.getElementById('messageInput');
  chats[sender].push({from:sender,msg:msg});
  if(messageInput.currentName==sender.toLowerCase())
    addLineQuiet(msg,sender)
  else
    notice(sender);
}
function addLineQuiet(msg, sender) {
  const messageArea = document.getElementById('messageArea');
  let d = document.createElement('div');
  d.classList.add('message');
  if(sender=="..me..") {
    d.classList.add('message-me');
    sender="Me";
  }
  d.innerHTML="<span class='sender'>"+sender+"</span><span class='msg'>"+msg+"</span>";
  messageArea.appendChild(d);
  messageArea.scroll({ top:messageArea.scrollHeight, behavior:"smooth" });
}
function createContextMenuForName(name, sidebar, nameElement) {
  return function(event) {
    event.preventDefault();
    if (name === "@status") return;

    let contextMenu = document.getElementById('contextMenu');
    if (!contextMenu) {
      contextMenu = document.createElement('div');
      contextMenu.id = 'contextMenu';
      document.body.appendChild(contextMenu);
    } else {
      contextMenu.innerHTML = '';
    }

    const menuList = document.createElement('ul');

    const closeChat = document.createElement('li');
    closeChat.textContent = 'Close';
    closeChat.addEventListener('click', () => {
      removeName(name, sidebar);
      contextMenu.style.display = 'none';
      const otherChats = sidebar.querySelectorAll('.message-name:not([style*="display: none"])');
      if (otherChats.length > 0) {
        setActive(otherChats[0]);
      }
    });
    menuList.appendChild(closeChat);

    contextMenu.appendChild(menuList);

    contextMenu.style.top = `${event.clientY}px`;
    contextMenu.style.left = `${event.clientX}px`;
    contextMenu.style.display = 'block';

    document.addEventListener('click', (e) => {
      if (e.target !== contextMenu) {
        contextMenu.style.display = 'none';
      }
    }, {once: true});
  };
}
function addName(name, sidebar) {
  let exists = false;
  let exists_obj;
  document.querySelectorAll('.message-name').forEach(n => {
    if (n.textContent === name) {
      exists = true;
      exists_obj = n;
      return;
    }
  });

  if (exists) {
    return exists_obj;
  }
  const nameElement = document.createElement('div');
  nameElement.textContent = name;
  nameElement.classList.add('message-name');

  nameElement.addEventListener('click', () => {
    setActive(nameElement);
  });

  nameElement.oncontextmenu = createContextMenuForName(name, sidebar, nameElement);

  sidebar.appendChild(nameElement);
  chats[name]=[];
  inputs[name]=[];
  return nameElement;
}
function removeName(name,sidebar) {
  document.querySelectorAll('.message-name').forEach(n => {
    console.log(name,n.textContent);
    if (n.textContent === name) {
      sidebar.removeChild(n);
    }
  });
  delete chats[name];
  delete inputs[name];
}
function showContextMenu(e, nameElement, sidebar) {
  if(nameElement.textContent==="@status")
    return;
  const existingMenu = document.getElementById('contextMenu');
  if (existingMenu) {
    existingMenu.remove();
  }

  const menu = document.createElement('div');
  menu.id = 'contextMenu';
  menu.style.top = `${e.clientY}px`;
  menu.style.left = `${e.clientX}px`;
  menu.innerHTML = `<ul><li id="closeContext">Close</li></ul>`;
  document.body.appendChild(menu);

  document.getElementById('closeContext').onclick = () => {
    sidebar.removeChild(nameElement);
    menu.remove();
  };
  window.onclick = () => {
    menu.remove();
  };
}
