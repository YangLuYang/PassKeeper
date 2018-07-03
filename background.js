
const SourceEnum = {
    CONTENT: 'content',
    BACKGROUND: 'background',
    OPTIONS: 'options'
};
const ActionEnum = {
    EXEC_REGISTER: 'exec_register',
    EXEC_UNLOCK: 'exec_unlock',
    EXEC_UPLOAD: 'exec_upload',
    EXEC_PULL_LIST: 'exec_pull_list',
    ACTION_NOTIFY: 'action_notify',
    ACTION_STATE_NET: 'action_state_net',
    ACTION_STATE_REGISTER: 'action_state_register',
    ACTION_STATE_UNLOCK: 'action_state_unlock',
    ACTION_DATA_ADDRESS: 'action_data_address',
    ACTION_GET_PASSWORD: 'action_get_password',
    ACTION_GENERATE_PASSWORD: 'action_generate_password',
    ACTION_GET_ACCOUNT: 'action_get_account',
    ACTION_DEFAULT: 'action_default',
    ACTION_SET_ACCOUNT: 'action_set_account',
    ACTION_SET_PASSWORD: 'action_set_password'
};
class Intent {
    constructor(to, action, data, from){
        this.to = to;
        this.action = action;
        this.data = data;
        this.from = from;
    }
}
class Pass {
    constructor(host='', account='', password=''){
        this.host = host;
        this.account = account;
        this.password = password;
    }
}
//aes加密
const Encrypt = function (data, key) {
    try{
        key = CryptoJS.enc.Utf8.parse(key);
        let iv = CryptoJS.enc.Utf8.parse('16-Bytes--String');
        let encrypted = CryptoJS.AES.encrypt(JSON.stringify(data), key,
            {
                iv: iv,
                mode: CryptoJS.mode.CBC,
                padding: CryptoJS.pad.Pkcs7
            });
        return encrypted.toString();
    }catch (err){
        console.error(err);
    }

};
//aes解密
const Decrypt = function (data, key) {
    try{
        key = CryptoJS.enc.Utf8.parse(key);
        let iv = CryptoJS.enc.Utf8.parse('16-Bytes--String');
        let decrypted = CryptoJS.AES.decrypt(data, key,
            {
                iv: iv,
                mode: CryptoJS.mode.CBC,
                padding: CryptoJS.pad.Pkcs7
            });
        var decryptedData = JSON.parse(decrypted.toString(CryptoJS.enc.Utf8));
        return decryptedData;
    }catch (err){
        console.error(err)
    }

};
//md5加密
const md5Encrypt = function (data) {
    return CryptoJS.MD5(data).toString();
};
function geti18n(key) {
    return chrome.i18n.getMessage(key);
}

let pass = new Pass(),
    tabList = new Map(), //所有加载了content.js的tab
    storage = chrome.storage.local,
    proxy = new Proxy(pass, {
        get(target, property){
            console.log(`get props: ${property}`);
            return target[property];
        },
        set(target, property, value){
            console.log(`set props: ${property} to ${value}`);
            target[property] = value;
            if (target.host!==''&& target.account !==''&& target.password!=='') {
                console.log('设置完毕'+JSON.stringify(target));
                //同一个host，保存多次，只取最后一次
                saveToStorage(target);
            }
        }
    }),
    messageQueue = []; //消息队列

window.globle_state = {
    neb_state: '', //测试网状态
    is_unlock: false,   //是否解锁
    is_registered: false, //是否注册
    unlock_time: 0,         //解锁时间
    unlock_timer: 5*60*1000,   //解锁时长，默认5min
    autounlock: false,      //TODO 自动解锁
};
window.globle_data = {
    user_address: '',   //用户地址
    user_balance: '',   //用户余额
    local_pass: [],
    sync_pass:  [],
    local_pass_count: 0,
    sync_pass_count: 0,
    key: '',
    md5_key: ''
};
//使用proxy拦截所有对is_unlock的get与set
window.state_proxy = new Proxy(globle_state, {
    set(target, property, value){
        console.log(`set props: ${property} to ${value}`);
        target[property] = value;
        if(property === 'is_unlock' && value === true){
            globle_state.unlock_time = Number(new Date());
        }

    },
    get(target, property){
        if(property === 'is_unlock' && globle_state.is_unlock === true){
            if(Number(new Date())-globle_state.unlock_time>globle_state.unlock_timer
                || Number(new Date())-globle_state.unlock_time<0){
                globle_state.is_unlock = false;
                data_proxy.key = '';
                console.log('set is_unlock to false and set key to undefined')
            }
        }
        if(property in target){
            return `${target[property]}`;
        }else {
            throw new ReferenceError("Property \"" + property + "\" does not exist.");
        }
    }
});
window.data_proxy = new Proxy(globle_data, {
    set(target, property, value){
        if(property === 'key'){
            console.log('set key to '+value);
        }
        target[property] = value;
    },
    get(target, prop) {
        if(prop === 'key'){
            //检查当前解锁状况
            const status = state_proxy.is_unlock;
            if(status || status === true){
                return target[prop];
            }else {
                return '';
            }

        }
        if(prop.toString().indexOf('pass')!==-1){
            globle_data.local_pass_count = globle_data.local_pass.length;
            globle_data.sync_pass_count = globle_data.sync_pass.length;
            //set badge
            chrome.browserAction.setBadgeText({text:String(globle_data.sync_pass_count)});
        }
        return target[prop];
    }
});
chrome.runtime.onStartup.addListener(function () {
    console.log("Extension onStartup");
});
chrome.runtime.onInstalled.addListener(function () {
    console.log("Extension onInstalled");
    //初始化菜单
    setUpContextMenus();
    //初始化storage
    setUpPersistent();
    //初始化globle_data
    setUpGlobleData();
    //首次使用，发送通知
    showNotification("请阅读使用说明", 4000);
    chrome.tabs.create({url: 'html/tutorial.html'})
});
chrome.browserAction.onClicked.addListener(function (tab) {
    chrome.tabs.create({'url': chrome.extension.getURL('index.html'), 'selected': true, 'highlighted': 'true'})
});

function setUpPersistent() {
    storage.set({
        ['auto_unlock']: false,
        ['local_pass']: [],//所有保存的密码
        ['local_pass_count']: 0,
    });
}
function setUpGlobleData() {
    storage.get(['local_pass'],(result)=>{
        globle_data.sync_pass = result.local_pass || [];
    });
    storage.get(['local_pass_count'], (result)=>{
        globle_data.sync_pass_count = Number.parseInt(result.local_pass_count);
    });
}
function setUpContextMenus() {
    chrome.contextMenus.create({
        title: geti18n("menu_save_account"),
        id: '0',
        type: "normal",
        contexts: ["editable"],
        onclick: onMenuItemClick,
    },function () {
        // console.log("MenuItem init")
    });
    chrome.contextMenus.create({
        title: geti18n("menu_save_password"),
        id: '1',
        type: 'normal',
        contexts: ["editable"],
        onclick: onMenuItemClick,
    },function () {
        // console.log("MenuItem init")
    });
    chrome.contextMenus.create({
        title: geti18n("menu_generate_password"),
        id: '2',
        type: "normal",
        contexts: ["editable"],
        onclick: onMenuItemClick,
    },function () {
        // console.log("MenuItem init")
    });

    chrome.contextMenus.create({
        title: geti18n("menu_set_account"),
        id: '3',
        type: "normal",
        contexts: ["editable"],
        onclick: onMenuItemClick,
    },function () {
        // console.log("MenuItem init")
    });

    chrome.contextMenus.create({
        title: geti18n("menu_set_password"),
        id: '4',
        type: "normal",
        contexts: ["editable"],
        onclick: onMenuItemClick,
    },function () {
        // console.log("MenuItem init")
    });


}

//接收消息
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse){
    console.log(JSON.stringify(message));
    if(message.action === 'request_for_pass_list'){
        //判断is_unlock
        if(state_proxy.is_unlock === true || state_proxy.is_unlock === 'true'){
            chrome.tabs.sendMessage(parseInt(sender.tab.id), {
                action: "set_pass_list",
                data: data_proxy.local_pass
            });
            return;
        }else {
            chrome.tabs.sendMessage(parseInt(sender.tab.id), {
                action: "is_locked"
            });
            return;

        }
    }
    //获取tabId
    if(message.hello === "hello"){
        tabList.set(sender.tab.id,sender.url);
        chrome.tabs.sendMessage(sender.tab.id, {greeting: "hello"},function(response) {
            console.log(response);
        });
    }
    if(message.to === SourceEnum.BACKGROUND){
        //发送通知
        if(message.action === ActionEnum.ACTION_NOTIFY){
            messageQueue.unshift(message.data);
            if(messageQueue.length === 1){
                showNotification(messageQueue.pop())
            }else {
                setTimeout(showNotification(messageQueue.pop()),200);
            }
        }

        if(message.from === SourceEnum.CONTENT){
            switch (message.action){
                case ActionEnum.ACTION_STATE_NET:
                    state_proxy.neb_state = message.data.neb_state;
                    console.log("State_NebState:"+JSON.stringify(globle_state.neb_state));
                    break;
                case ActionEnum.ACTION_STATE_REGISTER:
                    state_proxy.is_registered = message.data.is_registered;
                    break;
                case ActionEnum.ACTION_STATE_UNLOCK:
                    state_proxy.is_unlock = message.data.is_unlock;
                    break;
                case ActionEnum.ACTION_DATA_ADDRESS:
                    globle_data.user_address = message.data.address;
                    break;
                case ActionEnum.EXEC_REGISTER:
                    console.log(globle_data.user_address+"注册成功？"+message.data);
                    state_proxy.is_registered = message.data;
                    break;
                case ActionEnum.EXEC_UNLOCK:
                    let request = new Intent(SourceEnum.OPTIONS,ActionEnum.EXEC_UNLOCK,message.data,SourceEnum.BACKGROUND);
                    sendMsg(request);
                    break;
                case ActionEnum.EXEC_UPLOAD:
                    console.log(message.data);
                    if(message.data||message.data === 'true'){
                        //清空待上传的列表
                        clearStoragePass();
                    }
                    break;
                case ActionEnum.EXEC_PULL_LIST:
                    //解密
                    let decryptPass = [];
                    message.data.forEach(item=>{
                        decryptPass.push(new Pass(item.host, Decrypt(item.account, data_proxy.key), Decrypt(item.password, data_proxy.key)))
                    });
                    data_proxy.local_pass = Array.from(new Set(decryptPass.concat(data_proxy.sync_pass)));
                    //发送至options
                    let intent = new Intent(SourceEnum.OPTIONS,ActionEnum.EXEC_PULL_LIST,data_proxy.local_pass,SourceEnum.BACKGROUND);
                    sendMsg(intent);
                    break;
            }
        }
        if(message.from === SourceEnum.OPTIONS){
            let request = new Intent(SourceEnum.CONTENT,message.action,{args: message.data},SourceEnum.BACKGROUND);
            switch (message.action){
                case ActionEnum.EXEC_REGISTER:
                    sendMsgToTab(request);
                    break;
                case ActionEnum.EXEC_UNLOCK:
                    data_proxy.key = message.data.key;
                    data_proxy.md5_key = message.data.md5key;
                    console.log(data_proxy.md5_key);
                    request.data = {args: message.data.md5key};
                    sendMsgToTab(request);
                    break;
                case ActionEnum.EXEC_UPLOAD:
                    //判断sync_pass长度，如果为0，则提示不需要上传
                    if(data_proxy.sync_pass_count===0){
                        showNotification(geti18n("string_pass_list_empty"));
                        return
                    }
                    //上传时加密,不加密host
                    let encryptPass = [];
                    data_proxy.sync_pass.forEach((item)=>{
                       encryptPass.push(new Pass(item.host, Encrypt(item.account,data_proxy.key), Encrypt(item.password, data_proxy.key)));
                    });
                    request.data ={
                        list: encryptPass,
                        password: data_proxy.md5_key
                    };
                    sendMsgToTab(request);
                    break;
                case ActionEnum.EXEC_PULL_LIST:
                    console.log(data_proxy.md5_key);
                    if(!message.data){
                        request.data = {args: data_proxy.md5_key};
                    }
                    sendMsgToTab(request);
                    break;
            }

        }
    }

});
const sendMsg = function (message) {
    chrome.runtime.sendMessage(message, function (resp) {
        console.log(resp);
    })
};
const sendMsgToTab = function (message) {
    getAllTabs().then(tabs=>{
        return new Promise((resolve, reject)=>{
            let activeTabsMap = new Map();
            tabs.forEach((item)=>{
                activeTabsMap.set(item.id,item.url);
            });
            let newTablist = new Map();
            for(let [k,v] of tabList.entries()){
                if(activeTabsMap.has(k)){
                    newTablist.set(k,v);
                }
            }
            tabList = newTablist;
            tabList.size > 0 ? resolve() : reject();
        });
    }).finally(()=>{
        if(tabList.size === 0){
            showNotification(geti18n("notify_no_content"))
        }
        chrome.tabs.sendMessage([...tabList.keys()][0], message);
    });
};
//获取当前所有的tabID
function getAllTabs () {
    return new Promise((resolve, reject) => {
        chrome.tabs.query({},
            (currentWindowActiveTabs = []) => {
            if (!currentWindowActiveTabs.length) reject();
            resolve(currentWindowActiveTabs);
        });
    });
}
//update & show notification
let notificationId;
let canUpdated = false;
let lastS
const showNotification = function(message, duration = 3000){
    console.log("创建通知:"+message);
    chrome.notifications.getPermissionLevel(function (level) {
        if(level!=='granted'){
            console.log("没有Notification权限")
        }else {
            let opt = {
                type: 'basic',
                title: 'PassKeeper',
                message: message,
                iconUrl: 'images/origin.png',
            };
            chrome.notifications.getAll(function (nids) {
                if(nids instanceof Object){
                    if(nids.hasOwnProperty(notificationId)){
                        canUpdated = true;
                    }
                }
            });
            if(notificationId && canUpdated){
                chrome.notifications.update(notificationId,opt, function (wasUpdated) {
                    console.log(wasUpdated);
                })
            }else {
                chrome.notifications.create('', opt, function(nId){
                    notificationId = nId;
                    setTimeout(function(){
                        canUpdated = false;
                        chrome.notifications.clear(nId, function () {});
                    }, duration);
                });
            }

        }
    });
};
/**
 *
 * @param o {"editable":true,"frameId":0,"menuItemId":"0","pageUrl":"https://stackoverflow.com/","selectionText":"Search"}
 * @param tab
 */
function onMenuItemClick(o, tab) {
    let intent = new Intent(SourceEnum.CONTENT,ActionEnum.ACTION_DEFAULT,'',SourceEnum.BACKGROUND);
    const host = getHost(o.pageUrl);
    proxy.host = host;
    switch (o.menuItemId){
        case '0':
            //保存用户名
            // let user_name = o.selectionText.toString().trim();
            intent.action = ActionEnum.ACTION_GET_PASSWORD;
            let account = '';
            chrome.tabs.sendMessage(tab.id, intent, function (resp) {
                console.log(resp);
                proxy.account = resp;
            });
            break;
        case '1':
            //保存密码
            intent.action = ActionEnum.ACTION_GET_PASSWORD;
            let password1 = '';
            chrome.tabs.sendMessage(tab.id, intent, function (resp) {
                console.log(resp);
                password1 = resp;
                proxy.password = password1;
            });
            break;
        case '2':
            //生成随机密码并保存
            const password2 = generatePassword();
            intent.action = ActionEnum.ACTION_GENERATE_PASSWORD;
            intent.data = password2;
            chrome.tabs.sendMessage(tab.id, intent, function (resp) {
                console.log(resp);
            });
            proxy.password = password2;
            break;
        case '3':
            intent.action = ActionEnum.ACTION_SET_ACCOUNT;
        case '4':
            intent.action = ActionEnum.ACTION_SET_PASSWORD;
            console.log(o.menuItemId === '3'?"用户名":"密码");
            //判断是否解锁
            if (state_proxy.is_unlock === true || state_proxy.is_unlock === 'true') {
                let results = data_proxy.local_pass.filter((item) => {
                    if (item.host === host) {
                        return item;
                    }
                });
                console.log(results);
                if(results instanceof Pass || (results instanceof Array && results.length>0)){
                    //TODO 多个密码保存的情况
                    intent.data = o.menuItemId === '3'?results[0].account:results[0].password;
                    chrome.tabs.sendMessage(tab.id, intent);
                }else {
                    //TODO 离线保存
                    showNotification(geti18n("notify_no_host"))
                }

            }else {
                showNotification(geti18n("notify_please_unlock"))
            }
            break;
    }
}


//生成密码, 默认长度8
function generatePassword(length = 8) {
    let charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
        retVal = "";
    for (let i = 0, n = charset.length; i < length; ++i) {
        retVal += charset.charAt(Math.floor(Math.random() * n));
    }
    return retVal;
}
function getHost(url) {
    return url.replace('http://','').replace('https://','').split(/[/?#]/)[0];
}


//保存未同步的Pass信息
const saveToStorage = function (pass) {
    //set to globel_data
    if(data_proxy.sync_pass_count === 0){
        data_proxy.sync_pass.push(pass);
    }else {
        let flag = false;
        data_proxy.sync_pass.forEach((item, index, array) => {
            if (item.host === pass.host) {
                array[index] = pass;
                flag = true;
            }
        });
        if (!flag) {
            data_proxy.sync_pass.push(pass);
        }
    }

    console.log(data_proxy.sync_pass);
    //set to storage
    storage.set({
        ['local_pass']: data_proxy.sync_pass
    },function () {
        storage.get(['local_pass'],(result)=>{
            console.log('保存local_pass:'+JSON.stringify(result))
        });
    });
    storage.set({
        ['local_pass_count']: data_proxy.sync_pass_count
    },function () {
        storage.get(['local_pass_count'],(result=>{
            console.log('保存local_pass_count'+JSON.stringify(result))
        }));
    });


};
const saveSyncStorage = function () {
    storage.set({
        ['local_pass']: data_proxy.sync_pass
    });
    storage.set({
        ['local_pass_count']: data_proxy.sync_pass_count
    })
}
//上传完毕，删除storage 中的数据
const clearStoragePass = function () {
    data_proxy.sync_pass = [];
    storage.get(['local_pass'],function () {
        storage.remove('local_pass',function () {
            storage.get(['local_pass'],function (result) {
                console.log(result);
            });
        });
    });

    storage.get(['local_pass_count'],function () {
        storage.set({
            ['local_pass_count']:0
        },function () {
            storage.get(['local_pass_count'],function (result) {
                console.log(result);
            })
        })
    });
};
//保存其他状态信息
const saveState = function (key, value) {
    storage.set({
        [key]: value
    },function () {
        console.log('keep '+key+' to '+value);
    })
};




