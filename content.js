console.log("content.js is loading");
let chainnetConfig = {
    mainnet: {
        name: "主网",
        contractAddress: "n1gW7f5qtjapLVj6mXHkMnHCtDFDG7VrSpR",
        txhash: "6ca8e47ab20ce0de3d4e0b1a7506300e8c699e632af1f56538e3d6d9451d95de",
        host: "https://mainnet.nebulas.io",
        payhost: "https://pay.nebulas.io/api/mainnet/pay"
    },
    testnet: {
        name: "测试网",
        contractAddress: "n1hxFcjyBAQ9YNzz8aNPTS6ozgdRdkvA4jc",
        host: "https://testnet.nebulas.io",
        payhost: "https://pay.nebulas.io/api/pay"
    }
};
let chain = "mainnet",
    nebState,
    chainInfo = chainnetConfig[chain],
    nebulas = require("nebulas"),
    neb = new nebulas.Neb(),
    HttpRequest = nebulas.HttpRequest;
neb.setRequest(new HttpRequest(chainInfo.host));

let user = {
        address: null,
        password: "",
        balance: null,
        txhash: null
    };

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
    constructor(host, account, password){
        this.host = host;
        this.account = account;
        this.password = password;
    }

    toString(){
        return JSON.stringify(this);
    }
}
function geti18n(key) {
    return chrome.i18n.getMessage(key);
}


let intent = new Intent(SourceEnum.BACKGROUND,ActionEnum.ACTION_DEFAULT,'',SourceEnum.CONTENT);


//set inpage.js
// function setupInjection (file) {
//     let s = document.createElement('script');
//     s.src = chrome.extension.getURL(file);
//     let container = document.head || document.documentElement;
//     container.insertBefore(s, container.children[0]);
//     s.onload = function() {s.remove();};
// }
//
// let file = 'inpage.js';
// setupInjection (file);

const sendMsg = function(message){
    console.log(message);
    chrome.runtime.sendMessage(message);
};

chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
        if (request.greeting === "hello"){
            sendResponse({farewell: "goodbye"});
        }
        if(request.to === SourceEnum.CONTENT){
            console.log('Content get message: '+JSON.stringify(request));
            if(request.from === SourceEnum.BACKGROUND){
                intent.action = ActionEnum.ACTION_NOTIFY;
                switch (request.action){
                    case ActionEnum.EXEC_REGISTER:
                        //注册
                        setUser(request.data);
                        break;
                    case ActionEnum.EXEC_UNLOCK:
                        //解锁
                        unlock(request.data);
                        break;
                    case ActionEnum.EXEC_UPLOAD:
                        //上传密码
                        uploadPass(request.data.list, request.data.password);
                        break;
                    case ActionEnum.EXEC_PULL_LIST:
                        //获取密码列表
                        getAllPass(request.data.args);
                        break;
                        //获取密码
                    case ActionEnum.ACTION_GET_PASSWORD:
                        const pwd = $(document.activeElement).val();
                        // console.log(pwd);
                        sendResponse(pwd);
                        break;
                        //生成密码
                    case ActionEnum.ACTION_GENERATE_PASSWORD:
                        let input = $(document.activeElement);
                        input.val(request.data);
                        sendResponse(input.val());
                        break;
                    case ActionEnum.ACTION_SET_ACCOUNT:
                    case ActionEnum.ACTION_SET_PASSWORD:
                        $(document.activeElement).val(request.data);
                        break;
                }
            }


        }
    });


/**
 * 注册
 * @param message {args: 'password'}
 */
const postUser = function(args){
    window.postMessage({
        "target": "contentscript",
        "data":{
            "to": chainInfo.contractAddress,
            "value": "0",
            "contract":{
                "function": "setUser",
                "args": args
            }
        },
        "method": "neb_sendTransaction"
    }, "*");

    window.addEventListener('message', function(e) {
        // console.log("message received, msg.data: " + JSON.stringify(e));
        try{
            if(!!e.data.data.txhash){
                console.log( "Transaction hash:\n" +  JSON.stringify(e.data.data.txhash.txhash,null,'\t'));
                user.txhash = e.data.data.txhash.txhash;
                //验证交易是否成功
                getTranResult(user.txhash,"setUser");
            }
        }catch (err){
            console.log(err);
        }

    });

};
function setUser(password) {
    //发送通知
    intent.data = geti18n("notify_popup");
    sendMsg(intent);
    //调起钱包插件
    postUser(JSON.stringify([password.args]));
};

/**
 * 解锁
 * @param password {args: 'password}
 */
function unlock(password) {
    intent.action = ActionEnum.ACTION_NOTIFY;
    intent.data = geti18n("notify_unlock_start");
    sendMsg(intent);

    fetchUnlockResp(JSON.stringify([password.args]))
        .then(function (state) {
            intent.action = ActionEnum.ACTION_NOTIFY;
            intent.data = state === true? geti18n("notify_unlock_success") : geti18n("notify_unlock_failed");
            sendMsg(intent);
            // console.log(state);
            intent.action = ActionEnum.ACTION_STATE_UNLOCK;
            intent.to = SourceEnum.BACKGROUND;
            intent.data = {
                is_unlock: state
            };
            sendMsg(intent);
            intent.action = ActionEnum.EXEC_UNLOCK;
            intent.data = state;
            sendMsg(intent);
        },function (err) {
            intent.action = ActionEnum.ACTION_NOTIFY;
            intent.data = JSON.stringify(err);
            sendMsg(intent);
        });
}
/**
 * 拉取密码列表
 * @param password
//  */
function getAllPass(password) {
    intent.action = ActionEnum.ACTION_NOTIFY;
    intent.data = geti18n("notify_pull_start");
    sendMsg(intent);
    //确认账户信息
    fetchUserState()
        .then(function (state) {
            //获取密码列表
            if(state.result === "true"){
                return fetchPassList(password);
            }else {
                console.log("该用户尚未注册")
            }
        })
        .then(function (list) {
            //返回数据至background.js
            list.forEach((item,index)=>{
                list[index] = new Pass(item.host, item.account, item.password);
            });
            intent.action = ActionEnum.EXEC_PULL_LIST;
            intent.data = list;
            sendMsg(intent);
            //通知
            intent.action = ActionEnum.ACTION_NOTIFY;
            intent.data = geti18n("notify_pull_success");
            sendMsg(intent)
        })
        .catch(function (err) {
            console.log(err);
            intent.action = ActionEnum.ACTION_NOTIFY;
            intent.data = geti18n("notify_pull_failed");
            sendMsg(intent)
        }
    );
};

/**
 * 上传密码列表
 * @param list 账号数组
 * @param password 用户密码md5
 */
function uploadPass(list, password) {
    intent.action = ActionEnum.ACTION_NOTIFY;
    intent.data = geti18n("notify_upload_start");
    sendMsg(intent);
    window.postMessage({
        "target": "contentscript",
        "data":{
            "to": chainInfo.contractAddress,
            "value": "0",
            "contract":{
                "function": "setPass",
                "args": JSON.stringify([list,password])
            }
        },
        "method": "neb_sendTransaction"
    }, "*");

    window.addEventListener('message', function(e) {
        try{
            if(!!e.data.data.txhash){
                console.log( "Transaction hash:\n" +  JSON.stringify(e.data.data.txhash.txhash,null,'\t'));
                user.txhash = e.data.data.txhash.txhash;
                //验证交易是否成功
                getTranResult(user.txhash,"setPass",password);
            }
        }catch (err){
            console.log(err);
        }

    });

}

let intervalTime = 5;
function getTranResult(txhash,func,args) {
    let timer = setInterval(function () {
        neb.api.getTransactionReceipt({
            hash: txhash
        }).then(function (receipt) {
            console.log(receipt);
            let intent = new Intent(SourceEnum.BACKGROUND, ActionEnum.ACTION_NOTIFY, '', SourceEnum.CONTENT);
            if(receipt.status === 1){
                if(func === 'setUser'){
                    //确认交易
                    fetchUserState().then(function (result) {
                        if(result.result === "true"){
                            intent.data = geti18n("notify_register_success");
                        }else if(result.result === "false"){
                            intent.data = geti18n("notify_register_failed");
                        }
                        sendMsg(intent);
                        intent.data = {
                            is_registered: result.result === "true"
                        };
                        intent.action = ActionEnum.ACTION_STATE_REGISTER;
                        sendMsg(intent);
                    });
                }else if(func === 'setPass'){
                    intent.action = ActionEnum.ACTION_NOTIFY;
                    intent.data = geti18n("notify_upload_success");
                    intent.to = SourceEnum.BACKGROUND;
                    sendMsg(intent);

                    intent.action = ActionEnum.EXEC_UPLOAD;
                    intent.data = true;
                    intent.to = SourceEnum.BACKGROUND;
                    sendMsg(intent);

                    getAllPass(args)

                }
                clearInterval(timer);
            }
            if(receipt.execute_result.startsWith("Error")){
                clearInterval(timer);
            }
            if(receipt.status === 0){
                console.log(receipt.execute_result);
                clearInterval(timer);
            }
        }).catch(function (err) {
            console.log(err);
            clearInterval(timer);
        })
    }, intervalTime * 1000);
}

//获取用户钱包地址
function fetchWalletInfo() {
    window.addEventListener('message', function (e) {
        if(e.data && e.data.data && e.data.data.account){
            //获取钱包账户地址
            user.address = e.data.data.account;
            intent.action = ActionEnum.ACTION_DATA_ADDRESS;
            intent.data = {
              address: user.address
            };
            sendMsg(intent);
            // console.log("获取用户钱包地址:"+intent.data);
        }
    });
    window.postMessage({
        "target": "contentscript",
        "data": {},
        "method": "getAccount",
    }, "*");
};
//获取节点信息
function fetchNebState(){
    console.log(new Date().toLocaleString());
    return new Promise(function (resolve, reject) {
        neb.api.getNebState().then(function (state) {
            nebState = state;
            console.log(nebState);
            resolve(nebState);
        }).catch(function (err) {
            reject(err);
        })
    });
}
//获取密码列表
function fetchPassList(password) {
    password = JSON.stringify([password]);
    return new Promise(function (resolve, reject) {
        neb.api.call({
            chainID: nebState.chain_id,
            from: user.address,
            to: chainInfo.contractAddress,
            value: 0,
            gasPrice: 1000000,
            gasLimit: 2000000,
            contract: {
                function: "getAllPass",
                args: password
            }
        }).then(function (resp) {
            console.log(resp);
            if(resp.execute_err.toString().length>0){
                reject(resp);
                return;
            }
            let list = JSON.parse(resp.result);
            resolve(list);
        }).catch(function (err) {
            reject(err)
        })
    })
}
//进行解锁
function fetchUnlockResp(password = user.password) {
    return new Promise(function (resolve, reject) {
        neb.api.call({
            chainID: nebState.chain_id,
            from: user.address,
            to: chainInfo.contractAddress,
            value: 0,
            gasPrice: 1000000,
            gasLimit: 2000000,
            contract: {
                function: "verifyUser",
                args: password
            }
        }).then(function (resp) {
            if(resp.result === "true"){
                console.log("解锁成功");
                resolve(true);
            }else if(resp.result === "false") {
                console.log("解锁失败，请确认密钥文件");
                resolve(false);
            }else {
                console.log("不支持的结果:"+resp);
                reject(resp);
            }
        }).catch(function (err) {
            reject(err);
        })
    });
};
//获取用户注册信息
function fetchUserState() {
    return new Promise(function (resolve, reject) {
        neb.api.call({
            chainID: nebState.chain_id,
            from: user.address,
            to: chainInfo.contractAddress,
            value: 0,
            gasPrice: 1000000,
            gasLimit: 2000000,
            contract: {
                function: "hasUser",
                args: ""
            }
        }).then(function (resp) {
            console.log(resp);
            if(resp.execute_err.toString().length>0){
                reject(resp);
                return;
            }
            if(resp.result === "true"){
                console.log("该钱包地址已注册");

            }else if(resp.result === "false") {
                console.log("该钱包地址未注册");

            }else {
                console.log("不支持的返回值:"+resp);
                reject(resp);
                return;
            }
            resolve(resp);
        }).catch(function (err) {
            reject(err)
        })
    });
}
//上传密码列表
function postPassList(list, password) {
    return new Promise(function (resolve, reject) {
        neb.api.call({
            chainID: nebState.chain_id,
            from: user.address,
            to: chainInfo.contractAddress,
            value: 0,
            gasPrice: 1000000,
            gasLimit: 2000000,
            contract: {
                function: "setPass",
                args: JSON.stringify([list,password])
            }
        }).then(function (resp) {
            console.log(resp);
            if(resp.result.startsWith('Error')||resp.execute_err.length>0){
                reject(resp);
                return;
            }else {
                resolve(resp);
                return;
            }
        },function (err) {
            reject(err);
        })
    })
}


//初始化
$(init());
function init() {
    //发送tabId
    chrome.runtime.sendMessage({hello: "hello"});
    //每个页面加载后需要重新获取网络状态与用户钱包信息
    //获取钱包地址
    fetchWalletInfo();
    try{
        fetchNebState().then(function (nebState) {
            //网络状态
            intent.data = {
                neb_state: nebState
            };
            intent.action = ActionEnum.ACTION_STATE_NET;
            sendMsg(intent);
            return fetchUserState();
        }).then(function (user) {
            //用户注册信息
            intent.data = {
                is_registered: user.result === "true"
            };
            intent.action = ActionEnum.ACTION_STATE_REGISTER;
            sendMsg(intent);
        },function (err) {
            console.log("查询用户注册信息出现异常："+JSON.stringify(err));
        });
    }catch (err){
        console.log(err)
    }

}


