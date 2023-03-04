/**
 * 該程式目的是要爬取 pchome 多個 url 的商品資料, 並將這些不同 url 的商品根據其商品 id 做交集, 取得多主題下的商品有哪些.
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

// Regex patten
const PROD_COUNT_REGEX = /[0-9]+/;
const PROD_REGEX = /\[.*\]/;

// Program variable
let data_cache = {};
let all_intersection_id_array = {};
const PCHOME_DOMAIN = "24h.pchome.com.tw";
const GITHUB_PAGE_URL = "https://cool9203.github.io/pchome-multi-category-search/src/SearchResult.html";
const QUERY_KEY = "intersection";


/** 
 * 取得商品 id
 * @param {object} data 商品資料, 根據 pchome API 的 PROD_API_URL 來的
 * @return {string} 商品 id
 */ 
function get_id(data){
    let split_id = data.Id.split("-");
    return `${split_id[0]}-${split_id[1]}`;
}


/** 
 * 定義 pchome API 拉回來的資料要取得那些, 資料來源為 PROD_API_URL
 * @param {string} cid category id, 該商品所在的主題 id
 * @param {string} pid prod id, 該商品的 id
 * @param {object} data 商品資料, 根據 pchome API 的 PROD_API_URL 來的
 * @return {string} 商品 id
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
 * @param {object} result 先前聯集完的結果
 * @param {object} data 爬蟲過後的結果
 * @param {array} intersection_id_array 要交集的 id array
 * @return {object} 交集後的結果, 資料型態為: {get_id(): get_data()}
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
 * @param {object} data 爬蟲過後的結果
 * @param {array} union_id_array 要聯集的 id array
 * @return {object} 交集後的結果, 資料型態為: {get_id(): get_data()}
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
 * 使用 fetch call API
 * @param {string} API url
 * @param {parse_regex} 
 * @return {string} API response string
 */ 
async function _call_api(url, parse_regex=undefined){
    console.debug(`call api: ${url}`);
    let response = await fetch(url);
    let data = await response.text();

    if (parse_regex !== undefined){
        data = parse_regex.exec(data);
    }
    return data;
}


/** 
 * 商品資料爬蟲
 * NOTE: 該 function 改動到 data_cache, 因為會直接新增該次爬回來的商品資料進去
 * @param {object} data 該次 call API 拿回來的商品資料, 根據 pchome API 的 PROD_API_URL 來的
 * @param {string} 該次爬取的主題, 指的是 url 所代表的商品類型(應該只傳 id 過來)
 */ 
function add_prod_to_data_cache(data, category_id){
    console.debug("start add_prod_to_data_cache");
    for (let j = 0; j < data.length; j = j + 1){
        if (!(category_id in data_cache)){
            data_cache[category_id] = [];
        }
        data_cache[category_id].push(data[j]);
    }
    console.debug("end add_prod_to_data_cache");
}


/** 
 * 該程式爬取 pchome 商品 API 的主要呼叫 function
 * 該 function 會呼叫 PROD_COUNT_API_URL
 * @param {string} id 主題 id
 */ 
async function pchome_crawler(id){
    console.debug("start pchome_crawler");
    console.debug(`id: ${id}`);
    if (id in data_cache){
        console.debug(`${id} data in cache`);
    }else{
        let prod_count_url = PROD_COUNT_API_URL.replace(REPLACE_CATEGORY, id);
        let count = await _call_api(prod_count_url, PROD_COUNT_REGEX);
        console.debug(`count: ${count}`);
        
        console.debug("start api_prod");
        let epochs = Math.ceil(count / PROD_LIMIT)
        for (let i = 0; i < epochs ; i = i + 1){
            let prod_url = null;
            prod_url = PROD_API_URL.replace(REPLACE_CATEGORY, id).replace(REPLACE_OFFSET, i * PROD_LIMIT);
            let data = await _call_api(prod_url, PROD_REGEX);
            add_prod_to_data_cache(JSON.parse(data), id);
        }
        console.debug("end api_prod");
    }
    console.debug("end pchome_crawler");
}


/**
 * API - Create
 * @param {string} id 商品 ID
 * @return {object} API response
 */
async function _add(key, id){
    if (!(key in all_intersection_id_array)){
        all_intersection_id_array[key] = [];
    }

    if (all_intersection_id_array[key].indexOf(id) == -1){
        all_intersection_id_array[key].push(id);
    }
    
    await pchome_crawler(id);

    return {success: true, action: "add"};
}


/**
 * API - Read
 * @return {object} API response
 */
function _get(key){
    let result = {};
    if (key in all_intersection_id_array){
        result = intersection(result, data_cache, all_intersection_id_array[key]);
    }
    return {result: result, success: true, action: "get"};
}


/**
 * API - Delete
 * @param {string} id 商品 ID
 * @return {object} API response
 */
function _delete(key, id){
    if (key in all_intersection_id_array){
        let index = all_intersection_id_array[key].indexOf(id);
        all_intersection_id_array[key].splice(index, 1);
    }
    return {success: true, action: "delete"};
}


/** 
 * user script API event
 */ 
chrome.runtime.onConnect.addListener(
    function(port) {
        console.log("Get connect");
        port.onMessage.addListener(
            async function(message){
                let result = {success: false, action: message.action};
                try{
                    if (message.action === "add"){  // 增加 id
                        console.log("add");
                        result = await _add(message.url, message.id);
                    }

                    else if (message.action === "get"){  // 取得結果
                        console.log("get");
                        result = _get(message.url);
                    }

                    else if (message.action === "delete"){  // 刪除 id
                        console.log("delete");
                        result = _delete(message.url, message.id);
                    }

                    else if (message.action === "get_intersection"){  // 取得 intersection array
                        console.log("get_intersection");
                        if (message.url in all_intersection_id_array){
                            result = {result: all_intersection_id_array[message.url], success: true, action: "get_intersection"};
                        }else{
                            result = {result: [], success: true, action: "get_intersection"};
                        }
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
    {hostContains: PCHOME_DOMAIN}
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
    let url = new URL(tab.url);
    let path_name = new URL(url).pathname.split("/");
    let url_id = path_name[path_name.length - 1];
    url = new URL(url.pathname, url.origin).href;
    console.debug(`url: ${url}`);
    console.debug(`url_id: ${url_id}`);

    let query = `${url_id}`;
    for (let i = 0; i < all_intersection_id_array[url].length; i = i + 1){
        let id = all_intersection_id_array[url][i];
        query += `,${id}`;
    }

    chrome.tabs.create({
        "url": `${GITHUB_PAGE_URL}?${QUERY_KEY}=${query}`
    });
});


// TODO: Tabs close event 需要清除data_cache
