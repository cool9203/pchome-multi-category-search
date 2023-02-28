/**
 * 該程式目的是要爬取 pchome 多個 url 的商品資料, 並將這些不同 url 的商品根據其商品 id 做交集, 取得多主題下的商品有哪些.
 * 打的 API 順序如下:
 * 1. PROD_COUNT_API_URL 先取得總商品數量, 由於 pchome 可以取得沒貨/遠古時期的商品資料, 需要先打這支確定 2. 3. 的前幾筆資料是有效的
 * 2. PROD_API_URL 實際取得商品資料的 API
 * 3. PROD_API_URL_RELEASE 實際取得商品資料的 API, 同時允許該程式爬取下個 prod url
 * 4. PROD_STATUS_API_URL 取得貨態 API
 * 請注意:
 * 該程式為了正確執行, 使用到互斥鎖 variable: mutex_lock
 * 目的是為了解決 pchome API 是用 jsonp, 且要將主題的 id 對應到爬取的商品(換句話說就是主題底下的商品要對得起來. aka 一個主題的商品要存在一樣地方, 不同主題要存在不同地方)
 */

// Program setting
const SETTING = {
    generate_page: {
        id: "GenerateMultiCategorySearchPage",
        title: "PchomeMultiCategorySearch: 生成報表",
    },
    generate_page_tab_create: {
        url: "",
        windowId: 123,
    },
}
const SLEEP_MS = 100; // 多久檢查一次商品資料是否爬完, 設定越短整個程式跑越快, 但會受限於 pchome API response 速度

// Replace string parameter
const REPLACE_CATEGORY = "<category_id>";
const REPLACE_PROD = "<prod_id>";
const REPLACE_OFFSET = "<offset>";

// Pchome api parameter
const PROD_LIMIT = 36;
const PROD_COUNT_API_URL = `https://ecapi-cdn.pchome.com.tw/cdn/ecshop/prodapi/v2/store/${REPLACE_CATEGORY}/prod/count&_callback=api_prod_count_callback`;
const PROD_API_URL = `https://ecapi-cdn.pchome.com.tw/cdn/ecshop/prodapi/v2/store/${REPLACE_CATEGORY}/prod&offset=${REPLACE_OFFSET}&limit=${PROD_LIMIT}&_callback=api_prod_callback`;
const PROD_URL = `https://24h.pchome.com.tw/prod/v1/${REPLACE_PROD}?fq=/S/${REPLACE_CATEGORY}`;
const IMG_URL = "https://cs-a.ecimg.tw";

// Fetch regex patten
const PROD_COUNT_REGEX = /[0-9]+/;
const PROD_REGEX = /\[.*\]/;

// Program variable
let category_id = null;
let prod_count = null;
let crawler_data = {};
let all_intersection_id_array = [];
let all_union_id_array = [];
let origin_url = null;


/** 
 * load jsonp
 * 雖然叫 jsonp, 但實際上就是讀取 js 檔案
 * @params {string} url 要讀取的 js 檔案 url
 */ 
async function _call_api(url, parse_regex){
    console.debug(`call api: ${url}`);
    let response = await fetch(url);
    let data = await response.text();
    return parse_regex.exec(data);
}


/** 
 * 取得商品 id
 * @params {object} data 商品資料, 根據 pchome API 的 PROD_API_URL 來的
 * @returns string 商品 id
 */ 
function get_id(data){
    let split_id = data.Id.split("-");
    return `${split_id[0]}-${split_id[1]}`;
}


/** 
 * 定義 pchome API 拉回來的資料要取得那些, 資料來源為 PROD_API_URL
 * @params {string} cid category id, 該商品所在的主題 id
 * @params {string} pid prod id, 該商品的 id
 * @params {object} data 商品資料, 根據 pchome API 的 PROD_API_URL 來的
 * @returns string 商品 id
 */ 
function get_data(cid, pid, data){
    let url = PROD_URL.replace(REPLACE_CATEGORY, cid).replace(REPLACE_PROD, pid); // pchome 的商品頁面連結
    let e = {
        "nick": data.Nick,
        "pic": data.Pic,
        "seq": data.Seq,
        "price": data.Price,
        "url": url,
    };
    return e;
}


/** 
 * 取得兩主題的商品交集
 * @params {object} result 先前聯集完的結果
 * @params {object} data 爬蟲過後的結果
 * @params {array} intersection_id_array 要交集的 id array
 * @returns object 交集後的結果, 資料型態為: {get_id(): get_data()}
 */ 
function intersection(result, data, intersection_id_array){
    let first_empty = Object.keys(result).length === 0 ? true : false;
    let epoch = 0;
    for (let cid in data){
        if (intersection_id_array.indexOf(cid) < 0){
            continue;
        }
        epoch += 1;
        console.debug(`epoch-${epoch} of ${cid} :`);

        let temp_data = {};
        if (Object.keys(result).length === 0 && first_empty){ // 若 result 一進來就是空集合, 則將第0筆視為 union 後的結果
            for (let i = 0; i < data[cid].length; i = i + 1){
                let pid = get_id(data[cid][i]);
                result[pid] = get_data(cid, pid, data[cid][i]);
            }
            first_empty = false;
            console.debug(result);
        }else{  // 否則則繼續做交集
            for (let i = 0; i < data[cid].length; i = i + 1){
                let pid = get_id(data[cid][i]);
                if (pid in result){
                    temp_data[pid] = get_data(cid, pid, data[cid][i]);
                }
            }
            console.debug(temp_data);
            result = temp_data;
        }
    }
    return result;
}


/** 
 * 取得兩主題的商品聯集
 * @params {object} data 爬蟲過後的結果
 * @params {array} union_id_array 要聯集的 id array
 * @returns object 交集後的結果, 資料型態為: {get_id(): get_data()}
 */ 
function union(data, union_id_array){
    let result = {};
    for (let cid in data){
        if (union_id_array.indexOf(cid) < 0){
            continue;
        }

        for (let i = 0; i < data[cid].length; i = i + 1){
            let pid = get_id(data[cid][i]);
            result[pid] = get_data(cid, pid, data[cid][i]);
        }
    }
    return result;
}


/** 
 * 商品資料爬蟲
 * 請注意: 
 * 依賴 crawler_data 與 category_id 這兩個變數
 * 該 callback 應該要同步執行, 才可以正確的將爬蟲回來的商品資料對應到 category_id
 * 否則將會得到錯誤的結果.
 * @params {object} data 商品資料, 根據 pchome API 的 PROD_API_URL 來的
 */ 
function api_prod_callback(data){
    console.debug("start api_prod_callback");
    for (let j = 0; j < data.length; j = j + 1){
        if (!(category_id in crawler_data)){
            crawler_data[category_id] = [];
        }
        crawler_data[category_id].push(data[j]);
    }
    console.debug("end api_prod_callback");
}


/** 
 * 爬取 pchome 商品 API 前 k 筆是有效的
 * 該 function 會呼叫 PROD_API_URL / PROD_API_URL_RELEASE
 * @params {int} count 有效商品筆數
 */ 
async function api_prod_count_callback(count){
    console.debug("start api_prod_count_callback");
    prod_count = count;
    let epochs = Math.ceil(count / PROD_LIMIT)
    for (let i = 0; i < epochs ; i = i + 1){
        let prod_url = null;
        prod_url = PROD_API_URL.replace(REPLACE_CATEGORY, category_id).replace(REPLACE_OFFSET, i * PROD_LIMIT);
        let data = await _call_api(prod_url, PROD_REGEX);
        api_prod_callback(JSON.parse(data));
    }
    console.debug("end api_prod_count_callback");
}


/** 
 * 該程式爬取 pchome 商品 API 的主要呼叫 function
 * 該 function 會呼叫 PROD_COUNT_API_URL
 * @params {string} id 主題 id
 */ 
async function pchome_crawler(id){
    console.debug("start pchome_crawler");
    category_id = id;
    let prod_count_url = PROD_COUNT_API_URL.replace(REPLACE_CATEGORY, category_id);
    let count = await _call_api(prod_count_url, PROD_COUNT_REGEX);
    await api_prod_count_callback(parseInt(count));
}


/**
 * API - Create
 * @params {string} id 商品 ID
 * @returns object API response
 */
async function _add(id){
    if (all_intersection_id_array.indexOf(id) == -1){
        all_intersection_id_array.push(id);
    }
    
    console.log(`start crawl id: ${id}`);
    await pchome_crawler(id);
    console.log(`end crawl id: ${id}`);
    return {success: true, action: "add"};
}


/**
 * API - Read
 * @returns object API response
 */
function _get(){
    let result = {};
    result = intersection(result, crawler_data, all_intersection_id_array);
    return {result: result, success: true, action: "get"};
}


/**
 * API - Delete
 * @params {string} id 商品 ID
 * @returns object API response
 */
function _delete(id){
    let index = all_intersection_id_array.indexOf(id);
    all_intersection_id_array.splice(index, 1);
    delete crawler_data[id];
    return {success: true, action: "delete"};
}


/**
 * check client url
 * @params {string} id 商品 ID
 * @returns object API response
 */
function _check_same_url(new_url){
    if (new_url === origin_url){
        return true;
    }
    else{
        origin_url = new_url;
        return false;
    }
}


/**
 * program variable reset
 */
function _reset(){
    crawler_data = {};
    all_intersection_id_array = [];
    all_union_id_array = [];
}


/** 
 * user script API event
 */ 
chrome.runtime.onConnect.addListener(
    function(port) {
        console.debug("Get connect");
        port.onMessage.addListener(
            async function(message){
                // 先確認當前網址是否有改變
                if (!_check_same_url(message.url)){
                    // 若有改變(get false)則需要 reset
                    console.debug("reset");
                    _reset();
                }

                let result = {success: false, action: message.action};
                try{
                    if (message.action === "add"){  // 增加 id
                        console.debug("add");
                        result = await _add(message.id);
                    }

                    else if (message.action === "get"){  // 取得結果
                        console.debug("get");
                        result = _get();
                    }

                    else if (message.action === "delete"){  // 刪除 id
                        console.debug("delete");
                        result = _delete(message.id);
                    }

                    else if (message.action === "get_intersection"){  // 取得 intersection array
                        console.debug("get_intersection");
                        result = {result: all_intersection_id_array, success: true, action: "get_intersection"};
                    }
                }
                catch (e){
                    console.log(e);
                }
                port.postMessage(result);  // 回傳 API 結果
            }
        );
    }
);


/**
 * 
 */
chrome.webNavigation.onCompleted.addListener(
    async function call_content_script_init(){
        let [tab] = await chrome.tabs.query({active: true, lastFocusedWindow: true});
        await chrome.tabs.sendMessage(tab.id, {action: "init"});
    },
    {hostContains: "24h.pchome.com.tw"}
)


/** 
 * 註冊滑鼠右鍵事件, 增加選項到右鍵選單裡
 */
chrome.runtime.onInstalled.addListener(() => {
    // 一次性的創建一個右鍵選單項目
    chrome.contextMenus.create(SETTING.generate_page);
});


/** 
 * 右鍵選單的選項, 增加點選產出報表功能事件
 */
chrome.contextMenus.onClicked.addListener((info, tab)=>{
    // 確認點擊的項目 id 是 showImageUrl
    if (info.menuItemId !== SETTING.generate_page.id) { 
        return; 
    }
    console.log("產生報表");

    let query = "";
    for (let i = 0; i < all_intersection_id_array.length; i = i + 1){
        let id = all_intersection_id_array[i];
        if (query === ""){
            query += id;
        }
        else{
            query += `,${id}`;
        }
    }

    chrome.tabs.create({
        "url": `https://cool9203.github.io/pchome-multi-category-search/src/SearchResult.html?intersection=${query}`
    });
});