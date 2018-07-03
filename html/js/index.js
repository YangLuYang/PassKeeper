let background = chrome.extension.getBackgroundPage(),
    state = background.state_proxy,
    data = background.data_proxy;
$(function () {
    if(state.is_unlock === true || state.is_unlock === 'true'){
        $('#local').html(initList(data.local_pass));
        $('#sync').html(initList(data.sync_pass));
        initList()
    }else {
        alert("尚未解锁")
        window.close();
    }
});
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

