'use strict';
/***
 * 所有涉及密码的操作
 * 均先验证用户
 */
//用户信息
class User {
    constructor(from, key){
        if(this.verifyAddress(from)){
            this.from = from;
            this.key = key;
        }else {
            let o = JSON.parse(from);
            this.from = o.from;
            this.key = o.key;
        }
    }

    toString(){
        return JSON.stringify(this);
    }
    verifyAddress(address){
        try {
            let result = Blockchain.verifyAddress(address);
            return result !== 0;
        }catch (e){
            return false;
        }
    }
}
//账户信息
class Pass {
    constructor(host, account, password){
        if(this.verifyHost(host)){
            this.host = host;
            this.account = account;
            this.password = password;
        }else {
            let o = JSON.parse(host);
            this.host = o.host;
            this.account = o.account;
            this.password = o.password;
        }
    }

    toString(){
        return JSON.stringify(this);
    }

    verifyHost(host){
        let RegUrl = new RegExp();
        RegUrl.compile("^([a-z0-9](?:[a-z0-9-]*[a-z0-9]))");
        return RegUrl.test(host);
    }
}
class PassKeeperContract {
    constructor(){
        LocalContractStorage.defineMapProperty(this, "configs", {
            parse: function(text) {
                return JSON.parse(text);
            },
            stringify: function(o) {
                return JSON.stringify(o);
            }
        });

        //某地址保存的所有密码
        //address => array of password
        LocalContractStorage.defineMapProperty(this, "passes", {
            parse: function (text) {
                let result = [],
                    items = JSON.parse(text);
                for(let i = 0; i < items.length; i++){
                    result.push(new Pass(JSON.stringify(items[i])));
                }
                return result;
            },

            stringify: function (o) {
                return JSON.stringify(o);
            }
        });

        //保存用户
        //address => user
        LocalContractStorage.defineMapProperty(this, "users", {
            parse: function (text) {
                return new User(text);
            },

            stringify: function (o) {
                return JSON.stringify(o);
            }
        })
    }


    init(){
        this.configs.set("admin", Blockchain.transaction.from);
        //TODO update password
    }

    /**
     * 新建用户
     * @param key 用户密钥md5值
     */
    setUser(key){
        let userAddr = Blockchain.transaction.from,
            newUser = new User(userAddr, key),
            user = this.users.get(userAddr);
        if(user instanceof User){
            throw new Error("该钱包地址已注册")
        }else {
            this.users.set(userAddr, newUser);
            return this.users.get(userAddr);
        }
    }

    /**
     * 验证用户
     * @param key 密钥文件md5值
     */
    verifyUser(key){
        let from = Blockchain.transaction.from,
            user = this.users.get(from);
        if(user instanceof User){
            return key === user.key;
        }else {
            throw new Error("该地址尚未注册用户")
        }
    }

    /**
     * 判断用户是否注册
     * @returns {boolean} true: 注册过 false: 未注册
     */
    hasUser(){
        let userAddr = Blockchain.transaction.from,
            user = this.users.get(userAddr);
        return user instanceof User;
    }

    /**
     * 设置密码
     * @param pwList 密码数组
     * @param key 密钥文件md5值
      */
    setPass(pwList, key){
        if(this.verifyUser(key)){
            let from = Blockchain.transaction.from;
            let passes = this.passes.get(from) || [];
            let list = pwList;
            if(list.length > 0){
                list.forEach((item)=>{
                    let psw = new Pass(item.host, item.account, item.password);
                    passes.unshift(psw);
                });
                this.passes.set(from, passes);
                return this.passes.get(from);
            }else {
                throw new Error("密码数组错误")
            }
        }else {
            throw new Error("密钥错误")
        }

    }

    /**
     * 获取某网站对应的用户名与密码
     * @param host host
     * @param key 密钥文件md5值
     */
    getPass(host, key){
        //验证用户
        if(this.verifyUser(key)){
            let from = Blockchain.transaction.from;
            let passes = this.passes.get(from) || [];
            let accounts = passes.filter((item)=>{
                //模糊匹配
                if(item.host.indexOf(host)!==-1){
                    return item;
                }
            });
            if(accounts.length > 0){
                return accounts;
            }else {
                throw new Error("该host对应的Pass不存在")
            }
        }else {
            throw new Error("密钥错误")
        }
    }

    /**
     * 获取所有存储的用户名与密码
     * @param key 密钥文件md5值
     */
    getAllPass(key){
        if(this.verifyUser(key)){
            let from = Blockchain.transaction.from;
            return this.passes.get(from) || [];
        }else {
            throw new Error("密钥错误")
        }
    }
}

module.exports = PassKeeperContract;