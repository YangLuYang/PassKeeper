let background = chrome.extension.getBackgroundPage(),
    state = background.state_proxy,
    data = background.data_proxy;
let sync = $('#sync');

$(function () {
    if(state.is_unlock === true || state.is_unlock === 'true'){
        $('#local').html(initList(data.local_pass));
        $('#sync').html(initList(data.sync_pass));
        initList()
    }else {
        alert("尚未解锁");
        window.close();
    }
});

$('#csv').on('change',function () {
    let file = document.getElementById('csv').files[0];
    if(typeof FileReader !== 'undefined'){
        let reader = new FileReader();
        reader.readAsText(file);
        reader.onload = function (e) {
            let data = e.target.result;
            let arrays = ($.csv.toArrays(data)).slice(1);
            let col3 = [];
            arrays.forEach((i)=>{
                col3.push(new Pass(i[0],i[2],i[3]));
            });
            background.globle_data.sync_pass = background.globle_data.sync_pass.concat(col3);
            console.log(background.globle_data.sync_pass);
            sync.html(initTable(arrays));
        };
    }else {
        alert('浏览器不兼容')
    }
});

const initTable = function (list) {
    let str = '';
    if(!list || list.length === 0){
        str+='<tr><td colspan="3">暂无密码信息</td></tr>';
    }else {
        list.forEach(item=>{
            //name(host), url, username, password
            str+=`
            <tr>
                <td>${item[0]}</td>
                <td>${item[2]}</td>
                <td>${item[3]}</td>
            </tr>
        `;
        });
    }
    return str;
};

const initList = function (list) {
    let str = '';
    if(!list || list.length === 0){
        str+='<tr><td colspan="3">暂无密码信息</td></tr>';
    }else {
        list.forEach(item=>{
            str+=`
            <tr>
                <td>${item.host}</td>
                <td>${item.account}</td>
                <td>${item.password}</td>
            </tr>
        `;
        });
    }
    return str;
};
class Pass {
    constructor(host='', account='', password=''){
        this.host = host;
        this.account = account;
        this.password = password;
    }
}