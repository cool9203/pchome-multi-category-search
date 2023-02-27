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
// Replace string parameter
const REPLACE_CATEGORY = "<category_id>";
const REPLACE_PROD = "<prod_id>";
const REPLACE_OFFSET = "<offset>";

// Pchome api parameter
const PROD_LIMIT = 36;
const PROD_COUNT_API_URL = `https://ecapi-cdn.pchome.com.tw/cdn/ecshop/prodapi/v2/store/${REPLACE_CATEGORY}/prod/count&_callback=api_prod_count_callback`;
const PROD_API_URL = `https://ecapi-cdn.pchome.com.tw/cdn/ecshop/prodapi/v2/store/${REPLACE_CATEGORY}/prod&offset=${REPLACE_OFFSET}&limit=${PROD_LIMIT}&_callback=api_prod_callback`;
const PROD_API_URL_RELEASE = `https://ecapi-cdn.pchome.com.tw/cdn/ecshop/prodapi/v2/store/${REPLACE_CATEGORY}/prod&offset=${REPLACE_OFFSET}&limit=${PROD_LIMIT}&_callback=api_prod_callback_release`;
const PROD_STATUS_API_URL = `https://ecapi-cdn.pchome.com.tw/ecshop/prodapi/v2/prod/button&id=${REPLACE_PROD}&fields=Id,Qty,ButtonType,Price,isPrimeOnly,Device&_callback=add_prod_status_callback`
const PROD_URL = `https://24h.pchome.com.tw/prod/v1/${REPLACE_PROD}?fq=/S/${REPLACE_CATEGORY}`;
const IMG_URL = "https://cs-a.ecimg.tw";

// Program setting
const SLEEP_MS = 100; // 多久檢查一次商品資料是否爬完, 設定越短整個程式跑越快, 但會受限於 pchome API response 速度

// Frontend element id
const PROD_SHOWER_ID = "prod_shower_content";
const RESULT_COUNT_ID = "result_count";

// Sleep function
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Program variable
let crawler_data = {};
let category_id = null;
let all_intersection_id_array = [];
let all_union_id_array = [];
let mutex_lock = true;
let prod_count = null;


/** 
 * load jsonp
 * 雖然叫 jsonp, 但實際上就是讀取 js 檔案
 * @params {string} url 要讀取的 js 檔案 url
 */ 
function import_js(url){
    let script = document.createElement("script");
    script.type = 'text/javascript';
    script.src = url;
    document.getElementsByTagName('head')[0].appendChild(script);
}


/** 
 * 取得商品 id
 * @params {object} data 商品資料, 根據 pchome API 的 PROD_API_URL 來的
 * @returns string 商品 id
 */ 
function get_id(data){
    return data.Id;
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
 * 增加商品貨態到網頁前端上
 * @params {array[object]} 商品的貨態 array
 */ 
function add_prod_status_callback(all_data){
    for (let i = 0; i < all_data.length; i = i + 1){
        let data = all_data[i];
        let id = data.Id;
        let qty = data.Qty;

        let a = document.querySelector(`#${id} td a`);
        let br = document.createElement("br");
        let text = document.createElement("a");
        text.innerHTML = `剩餘${qty}件`;

        if (qty <= 0){
            a.classList.add("no_stock");
        }

        a.appendChild(br);
        a.appendChild(text);
    }
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
    for (let j = 0; j < data.length; j = j + 1){
        if (!(category_id in crawler_data)){
            crawler_data[category_id] = [];
        }
        crawler_data[category_id].push(data[j]);
    }
}


/** 
 * 商品資料爬蟲, 呼叫時會通知程式可以繼續爬下一個 category_id 的 url
 * 請注意: 
 * 依賴 crawler_data 與 category_id 這兩個變數
 * 該 callback 應該要同步執行, 才可以正確的將爬蟲回來的商品資料對應到 category_id
 * 否則將會得到錯誤的結果
 * @params {object} data 商品資料, 根據 pchome API 的 PROD_API_URL 來的
 */ 
function api_prod_callback_release(data){
    for (let j = 0; j < data.length; j = j + 1){
        if (!(category_id in crawler_data)){
            crawler_data[category_id] = [];
        }
        crawler_data[category_id].push(data[j]);
    }
    crawler_data[category_id] = crawler_data[category_id].slice(0, prod_count);
    mutex_lock = true;
    console.log("mutex release");
}


/** 
 * 爬取 pchome 商品 API 前 k 筆是有效的
 * 該 function 會呼叫 PROD_API_URL / PROD_API_URL_RELEASE
 * @params {int} count 有效商品筆數
 */ 
function api_prod_count_callback(count){
    prod_count = count;
    let epochs = Math.ceil(count / PROD_LIMIT)
    for (let i = 0; i < epochs ; i = i + 1){
        let prod_url = null;

        if (i != epochs - 1){
            prod_url = PROD_API_URL.replace(REPLACE_CATEGORY, category_id).replace(REPLACE_OFFSET, i * PROD_LIMIT);
        }else{
            prod_url = PROD_API_URL_RELEASE.replace(REPLACE_CATEGORY, category_id).replace(REPLACE_OFFSET, i * PROD_LIMIT);
        }
        import_js(prod_url);
    }
}


/** 
 * 該程式爬取 pchome 商品 API 的主要呼叫 function
 * 該 function 會呼叫 PROD_COUNT_API_URL
 * @params {string} id 主題 id
 */ 
function pchome_crawler(id){
    category_id = id;
    let prod_count_url = PROD_COUNT_API_URL.replace(REPLACE_CATEGORY, category_id);
    import_js(prod_count_url);
}


/** 
 * 將 all_data 顯示到網頁前端上
 * @params {object} all_data 爬蟲完且交集完的資料
 */ 
function show(all_data){
    let result_count = document.getElementById(RESULT_COUNT_ID);
    let shower = document.getElementById(PROD_SHOWER_ID);
    result_count.textContent = `總共找到${Object.keys(all_data).length}個結果`;
    for (let id in all_data){
        let tr = get_table_element(all_data[id], id);
        shower.appendChild(tr);
    }
}


/** 
 * 取得網頁前端的 table 元素, 應該包含一系列的元素, 如 <tr><td><div><a></...>
 * @params {object} data 商品資料, 根據 get_data function 拿的資料
 * @params {string} id 商品的 id
 * @returns HtmlElement table 元素
 */ 
function get_table_element(data, id){
    let tr = document.createElement("tr");
    tr.id = id;

    let td = document.createElement("td");

    let a = document.createElement("a");
    a.href = data.url;

    let text = document.createElement("a");
    text.innerHTML = `${data.nick}<br>價格: ${data.price.P}`;

    let br = document.createElement("br");

    let img = document.createElement("img");
    img.src = new URL(data.pic.S, IMG_URL).href; // 刪除鈕
    img.alt = "商品圖片";
    img.title = "商品圖片";
    img.classList.add("prod_img");

    a.appendChild(img);
    a.appendChild(br);
    a.appendChild(text);
    td.appendChild(a);
    tr.appendChild(td);
    return tr;
}


/** 
 * 解析 url 的 query, url 指的是這網頁的
 * Reference: https://shunnien.github.io/2017/07/03/Get-Query-String-Parameters-with-JavaScript/
 * @params {string} url
 * @returns object 解析後的結果
 */ 
function query_string(url)
{
    // This function is anonymous, is executed immediately and
    // the return value is assigned to QueryString!
    let query_string = {};
    let query = url.search.substring(1);
    let vars = query.split("&");
    for (let i = 0; i < vars.length; i++)
    {
        let pair = vars[i].split("=");
        // If first entry with this name
        if (typeof query_string[pair[0]] === "undefined")
        {
            query_string[pair[0]] = pair[1];
            // If second entry with this name
        } else if (typeof query_string[pair[0]] === "string")
        {
            let arr = [query_string[pair[0]], pair[1]];
            query_string[pair[0]] = arr;
            // If third or later entry with this name
        } else
        {
            query_string[pair[0]].push(pair[1]);
        }
    }
    return query_string;
}


/** 
 * 轉換 url to id
 * @params {array} url array
 * @returns array id array
 */ 
function url_array_to_id_array(all_url_array){
    let all_id_array = [];
    for (let i = 0; i < all_url_array.length; i = i + 1){
        let path_name = new URL(all_url_array[i]).pathname.split("/");
        let id = path_name[path_name.length - 1];
        all_id_array.push(id);
    }
    return all_id_array;
}


/** 
 * 嘗試取得 url 的 query 變數數值
 * @params {array} variable_name_array 想要拿的變數名 array
 * @params {type} _default 任何型態的值, 當拿不到這值時需要拿它當作預設值, 可以不輸入該值
 * @params {type} split_token 預設是 pass array 型態過來, 所以要 split 成 array
 * @returns array/str 取得的變數對應數值
 */ 
function try_get_query_variable_value(variable_name_array, _default, split_token=","){
    let value = undefined;
    for (let i = 0; i < variable_name_array.length; i = i + 1){
        let variable_name = variable_name_array[i];

        try{
            value = query_string(window.location)[variable_name];
        }
        catch{
            try{
                value = query_string(window.location)[variable_name];
            }
            catch{}
        }

        if (value !== undefined && value.length > 0){
            console.debug(`value: ${value}`);
            if (split_token !== null ** split_token !== undefined && split_token.length > 0){
                value = value.split(split_token);
            }
            break;
        }
    }

    if (value === undefined || value.length === 0){
        value = _default;
    }
    
    return value;
}


/** 
 * 該程式的進入點
 */ 
async function run(){
    // 從 url param 取得所有參數
    let all_url_array = try_get_query_variable_value(["all_url_array", "all_url", "url"], null);
    let all_id_array = try_get_query_variable_value(["all_id_array", "all_id", "id"], null);
    all_intersection_id_array = try_get_query_variable_value(["all_intersection_id_array", "all_intersection_id", "all_intersection_array", "all_intersection", "intersection", "inter"], []);
    all_union_id_array = try_get_query_variable_value(["all_union_id_array", "all_union_id", "all_union_array", "all_union", "union"], []);

    // 如果 pass url 過來, 那需要解析
    if (all_url_array !== null && all_id_array === null){
        all_id_array = url_array_to_id_array(all_url_array);
    }else if (all_id_array === null){
        all_id_array = [];
        all_id_array.push(...all_intersection_id_array);
        all_id_array.push(...all_union_id_array);
    }
    
    // fit 舊版本, 只有交集功能但沒有聯集功能
    if (all_intersection_id_array.length === 0 && all_union_id_array.length === 0){
        all_intersection_id_array = all_id_array;
    }

    console.debug(`all_url_array: ${all_url_array}`);
    console.debug(`all_id_array: ${all_id_array}`);
    console.debug(`all_intersection_id_array: ${all_intersection_id_array}`);
    console.debug(`all_union_id_array: ${all_union_id_array}`);
    
    // 使用 id array 的 id 爬取商品資料到 crawler_data
    for (let i = 0; i < all_id_array.length; i = i + 1){
        // 使用到互斥鎖, 防止資料競爭問題
        while (true){
            if (mutex_lock){
                console.log("mutex lock");
                console.log(`start crawl id: ${all_id_array[i]}`);
                mutex_lock = false;
                pchome_crawler(all_id_array[i]);
                break;
            }
            await sleep(SLEEP_MS);
        }
    }

    // 等待互斥鎖被 release
    while (true){
        if (mutex_lock){
            break;
        }
        await sleep(SLEEP_MS);
    }

    // 全部處理完時要做的事
    result = union(crawler_data, all_union_id_array);
    result = intersection(result, crawler_data, all_intersection_id_array);
    show(result);

    //顯示貨態, 要先取得所有 prod id
    let prod_string = "";
    for (let id in result){
        if (prod_string.length === 0){
            prod_string += id;
        }else{
            prod_string += `,${id}`;
        }
    }
    let prod_status_url = PROD_STATUS_API_URL.replace(REPLACE_PROD, prod_string);
    import_js(prod_status_url);
}


run();
