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
    ACTION_GET_ACCOUNT: 'action_get_account',
    ACTION_GENERATE_PASSWORD: 'action_generate_password',
    ACTION_DEFAULT: 'action_default',
    ACTION_SET_ACCOUNT: 'action_set_account',
    ACTION_SET_PASSWORD: 'action_set_password'
};
class Intent {
    constructor(to, action, data, from = SourceEnum.OPTIONS){
        this.to = to;
        this.action = action;
        this.data = data;
        this.from = from;
    }
}
function geti18n(key) {
    return chrome.i18n.getMessage(key);
}
//生成随机字符串
const randomString = function (len) {
    let text = "",
        possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for (let i = 0; i < len; i++)
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    return text;
};
//aes加密
const Encrypt = function (data, key) {
    key = CryptoJS.enc.Utf8.parse(key);
    let iv = CryptoJS.enc.Utf8.parse('16-Bytes--String');
    let encrypted = CryptoJS.AES.encrypt(JSON.stringify(data), key,
        {
            iv: iv,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7
        });
    return encrypted.toString();
};
//aes解密
const Decrypt = function (data, key) {
    key = CryptoJS.enc.Utf8.parse(key);
    let iv = CryptoJS.enc.Utf8.parse('16-Bytes--String');
    let decrypted = CryptoJS.AES.decrypt(data, key,
        {
            iv: iv,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7
        });
    let decryptedData = JSON.parse(decrypted.toString(CryptoJS.enc.Utf8));
    return decryptedData;
};
const md5Encrypt = function (data) {
    return CryptoJS.MD5(data).toString();
};


let btnUnlock = $('#unlock'),
    btnRegister = $('#register'),
    btnDownload = $('#download'),
    btnUpload = $('#upload'),
    btnPullList = $('#pull-list'),
    btnShowAll = $('#show-list'),
    wallet = $('#nas-wallet'),
    key = $('#key'),
    show = $('.show'),
    form = document.getElementById('form'),
    t_body = $('#t-body'),
    btnSearch = $('#btn-search'),
    inputSearch = $('#input-search'),
    func_area = $('.func-area'),
    background = chrome.extension.getBackgroundPage(),
    state = background.state_proxy;
    md5key = "",
    iv = "",
    keyFile='',
    passList = [];

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse){
    if(message.to === SourceEnum.OPTIONS){
        if(message.from === SourceEnum.BACKGROUND){
            switch (message.action){
                case ActionEnum.EXEC_REGISTER:
                    break;
                case ActionEnum.EXEC_UNLOCK:
                    let result = message.data;
                    if(result||result === 'true'){
                        //解锁成功
                        show.removeClass('hidden');
                        func_area.css('display','none');
                        //去重
                        initPassList(Array.from(new Set(background.data_proxy.local_pass.concat(background.data_proxy.sync_pass))));
                    }else {
                        //解锁失败
                        window.location.reload();
                    }
                    break;
                case ActionEnum.EXEC_UPLOAD:
                    break;
                case ActionEnum.EXEC_PULL_LIST:
                    passList = message.data;
                    show.removeClass('hidden');
                    $('#unlock').css('display','none');
                    func_area.css('display','none');
                    initPassList(passList);
                    break;
            }

        }
    }
});
const initPassList = function (list = [], warning = geti18n("string_no_account")) {
    passList = list;
    if(state.is_unlock === 'true'){
        if(list.length === 0){
            //数组长度为0，用户没有存过密码
            t_body.html("<tr><td colspan='3'>"+warning+"</td></tr>");
        }else {
            t_body.html(createNewPassRows(list));
        }
    }
};

function createNewPassRows(list) {
    let str = '';
    if(!list || list.size === 0){
        return "<tr><td colspan='3'>"+geti18n("string_no_account")+"</td></tr>";
    }
    list.forEach((item)=>{
        let s = "<tr><td title="+item.host+">"+item.host+"</td><td title="+item.account+">"+item.account+"</td><td title="+item.password+">"+item.password+"</td></tr>";
        str+=s;
    });
    return str;

}
//注册
const register = function () {
    let args = md5key;
    let intent = new Intent(SourceEnum.BACKGROUND,ActionEnum.EXEC_REGISTER,args);
    sendMsg(intent)
};
//解锁, 即查看密码列表或上传密码
const unlock = function () {
    //解锁
    // let args = md5key;
    let args = {
        md5key: md5key,
        key: keyFile
    };
    let intent = new Intent(SourceEnum.BACKGROUND,ActionEnum.EXEC_UNLOCK,args);
    sendMsg(intent);


    //拉取密码列表
    intent.action = ActionEnum.EXEC_PULL_LIST;
    intent.data = md5key;
    setTimeout( sendMsg(intent),1000);
};
//拉取密码列表
const pullList = function () {
    let intent = new Intent(SourceEnum.BACKGROUND,ActionEnum.EXEC_PULL_LIST,'');
    //拉取密码列表
    sendMsg(intent);
};



//发送消息
let sendMsg = function (message,callback) {
    chrome.runtime.sendMessage(message, callback)
};

//上传本地密码信息
const upload = function () {
  let intent = new Intent(SourceEnum.BACKGROUND,ActionEnum.EXEC_UPLOAD,'');
  sendMsg(intent);
};

//点击下载密钥文件
const download = function () {
    let content = randomString(16),
        blob = new Blob([content]);
    btnDownload.attr('href',URL.createObjectURL(blob));
    btnDownload.attr('download','key.k');

    let intent = new Intent(SourceEnum.BACKGROUND,ActionEnum.ACTION_NOTIFY,'请点击选择密钥文件，选中后请点击注册');
    sendMsg(intent);

    //点击后，隐藏"下载密码文件",显示"选择密钥文件"
    $('#download').css('display','none');
    $('#select-key').css('display','block');
    //更新提示语为：选择密钥文件
    $('#tip').html(geti18n("string_select_file"))
};
//搜索
const search = function () {
    let key_wrold = inputSearch.val().trim();
    console.log(key_wrold.length)
    if(key_wrold.length === 0){
        $('#search-result').css('display','none');
        return
    }
    let newList = passList.filter((item)=>{
        if(coverString(key_wrold,item.host.toString())||coverString(key_wrold,item.account.toString())||
            coverString(key_wrold,item.password.toString())){
            return item;
        }
    });
    if(newList.length === 0){
        //无符合筛选要求的字符串
        let intent = new Intent(SourceEnum.BACKGROUND,ActionEnum.ACTION_NOTIFY,geti18n("notify_search_failed"));
        sendMsg(intent);
        $('#search-result').css('display','none');
    }else {
        $('#td-host').html(newList[0].host);
        $('#td-account').html(newList[0].account);
        $('#td-password').html(newList[0].password);
        $('#search-result').css('display','block');
    }
};
function coverString(subStr,str){
    return str.toLowerCase().indexOf(subStr.toLowerCase()) > -1;
}

const openPassTab = function () {
    chrome.tabs.create({ url: "html/index.html"});
};


//监听选择密钥文件事件
key.on('change',function () {
    //隐藏 "选择密钥文件" "下载"
    //显示 查看key输入框
   $('#select-key').css('display','none');
   $('#download').css('display','none');
   $('#show-key').css('display','block');

   if(state.is_registered === "false") {
       //尚未注册 显示"注册" 隐藏"解锁"
       $('#register').css('display','block');
       $('#unlock').css('display','none');
   }else {
       //注册过，显示解锁按钮
       $('#unlock').css('display','block');
       //隐藏 "注册" "下载"
       $('#download').css('display','none');
       $('#register').css('display','none');
   }

   //读取密钥文件
    let file = document.getElementById("key").files[0],
        reader = new FileReader();
    reader.readAsText(file);
    reader.onload = function (e) {
        if(e.total!==16){
            // $('#show-key').val("请选择正确的密钥文件");
            let intent = new Intent(SourceEnum.BACKGROUND, ActionEnum.ACTION_NOTIFY,
                geti18n("notify_select_right_key"));
            sendMsg(intent);
            form.reset();
        }else {
            keyFile = e.target.result;
            $('#show-key').val(md5Encrypt(e.target.result));
            md5key = md5Encrypt(e.target.result);
            iv = md5Encrypt(e.target.result).slice(16,32);
            //remove disable
            btnUnlock.removeAttr('disabled');
            btnRegister.removeAttr('disabled');
        }
    };
});
//初始化布局
$(function () {
    //设置钱包地址
    wallet.val(background.globle_data.user_address);
    
    $('[data-i18n]').each(function() {
        let el = $(this),
            resourceName = el.data('i18n'),
            resourceText = chrome.i18n.getMessage(resourceName);
        el.text(resourceText);
    });

    console.log("注册情况:"+state.is_registered);
    let isUnlock = state.is_unlock;
    console.log("解锁情况:"+isUnlock);

    if(state.is_registered === 'true'){
        $('#download').css('display','none');
        $('#register').css('display','none');
    }else {
        $('#download').css('display','block');
        $('#register').css('display','block');
    }
    if(state.is_unlock === 'true'){
        //已解锁
        console.log("已解锁");
        show.removeClass('hidden');
        func_area.css('display','none');
        // initPassList(background.data_proxy.local_pass);
        initPassList(Array.from(new Set(background.data_proxy.local_pass.concat(background.data_proxy.sync_pass))));
    }else {
        //未解锁
    }
});
btnUnlock.click(unlock);
btnRegister.click(register);
btnDownload.click(download);
btnSearch.click(search);
btnUpload.click(upload);
btnPullList.click(pullList);
btnShowAll.click(openPassTab);

