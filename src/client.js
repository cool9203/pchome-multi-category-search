const ELEMENT_QUERY = "dl#MenuContainer li";
const TOP_PROD_QUERY = "div[_id]";
const PROD_QUERY = "dd[_id]";
const CHECKBOX_ID_PREFIX = "__";
const DELAY = 100;
const OPACITY = 0.1;

let PORT = chrome.runtime.connect();

console.log("Pchome multi category search load success!!");


/**
 * init event
 */
function init(){
    console.log("init");

    // 對所有左邊可以選的主題加入 checkbox
    let all_category = document.querySelectorAll(ELEMENT_QUERY);

    for (let i = 0; i < all_category.length; i = i + 1){
        let url = all_category[i].children[0].href;
        let path_name = new URL(url).pathname.split("/");
        let id = path_name[path_name.length - 1];

        let checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.id = `${CHECKBOX_ID_PREFIX}${id}`;
        
        // checkbox 的 event, 若要核選或取消核選時, 需要與擴充功能做交互
        checkbox.onchange = () => {
            let e = document.getElementById(`${CHECKBOX_ID_PREFIX}${id}`);
            console.debug("Send message");
            if (e.checked){ // 當前是要增加的
                PORT.postMessage({url: new URL(window.location.pathname, window.location.origin).href,
                    action: "add", 
                    id: id
                });
            }
            else{
                PORT.postMessage({url: new URL(window.location.pathname, window.location.origin).href,
                    action: "delete", 
                    id: id
                });
            }
        };
        all_category[i].insertAdjacentElement("afterbegin", checkbox);
    }

    // 預先 call 兩個 API, 若曾來過該頁面, 則會有上次的紀錄並沿用該紀錄
    // TODO: 可以有 clear 的選項
    PORT.postMessage({url: new URL(window.location.pathname, window.location.origin).href,
        action: "get"
    });
    PORT.postMessage({url: new URL(window.location.pathname, window.location.origin).href,
        action: "get_intersection"
    });
}


/**
 * 根據交集後的結果, 將頁面上的商品透明度做調整, 方便觀看
 * @param {object} result 
 */
function run(result){
    console.log("run");

    let all_query = [TOP_PROD_QUERY, PROD_QUERY];  // 由於 pchome 頁面設計會有兩種商品的呈現方式, 所以需要對兩種都做修改

    for (let query_index = 0; query_index < all_query.length; query_index = query_index + 1){
        let query = all_query[query_index];
        let nodes = document.querySelectorAll(query);

        for (let node_index = 0; node_index < nodes.length; node_index = node_index + 1){
            let node = nodes[node_index];
            let id = node.getAttribute("_id");

            // 做透明度的修改
            if (Object.keys(result).length > 0){
                // 若交集結果不為空, 則確認各 node 的商品 id 是否在 result 裡
                if (id in result){
                    node.style.opacity = 1.0;  // 存在則恢復原不透明
                }else{
                    node.style.opacity = OPACITY;  // 不存在則根據設定調整透明度
                }
            }else{
                // 若交集結果為空, 則所有商品都要恢復顯示
                node.style.opacity = 1.0;
            }
        }
    }
    
    console.log("end");
}


/**
 * 重新核選 checkbox  
 * 由於 user 會轉跳頁面, 所以需要在轉跳頁面時維持相同已核選的那些主題
 * @param {array} all_id 過往以核選的 checkbox id
 */
function recheck(all_id){
    console.log("recheck");
    console.debug(all_id);
    let nodes = document.querySelectorAll(`input[id^='${CHECKBOX_ID_PREFIX}'][type=checkbox]`);
    for (let i = 0; i < nodes.length; i = i + 1){
        let id = nodes[i].id.slice(2);
        if (all_id.indexOf(id) !== -1){
            nodes[i].checked = true;
        }
    }
}


/**
 * call 擴充功能的 API 的 on message event
 */
PORT.onMessage.addListener(function port_on_message(message) {
    if (message.action === "get"){
        let result = message.result;
        run(result);
    }else if (message.action === "get_intersection"){
        let result = message.result;
        recheck(result);
    }else{
        PORT.postMessage({url: new URL(window.location.pathname, window.location.origin).href,
            action: "get"
        });
    }
});


/**
 * 讓擴充功能的 background.js 確認頁面執行完沒, 執行完再 call content script init
 */
chrome.runtime.onMessage.addListener(
    function on_message(request, sender, sendResponse) {
        if (request.action === "init"){
            setTimeout(init, DELAY);
        }
    }
);
