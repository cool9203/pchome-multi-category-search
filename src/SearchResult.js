// pchome parameter
const REPLACE_CATEGORY = "<category_id>";
const REPLACE_PROD = "<prod_id>";
const PROD_LIMIT = 36;
const PROD_COUNT_API_URL = `https://ecapi-cdn.pchome.com.tw/cdn/ecshop/prodapi/v2/store/${REPLACE_CATEGORY}/prod/count&_callback=api_prod_count_callback`;
const PROD_API_URL = `https://ecapi-cdn.pchome.com.tw/cdn/ecshop/prodapi/v2/store/${REPLACE_CATEGORY}/prod&offset=0&limit=${PROD_LIMIT}&_callback=api_prod_callback`;
const PROD_API_URL_RELEASE = `https://ecapi-cdn.pchome.com.tw/cdn/ecshop/prodapi/v2/store/${REPLACE_CATEGORY}/prod&offset=0&limit=${PROD_LIMIT}&_callback=api_prod_callback_release`;
const PROD_URL = `https://24h.pchome.com.tw/prod/v1/${REPLACE_PROD}?fq=/S/${REPLACE_CATEGORY}`;
const IMG_URL = "https://cs-a.ecimg.tw";
const SLEEP_MS = 100;

// frontend id
const PROD_SHOWER_ID = "prod_shower_content";

// sleep function
const sleep = ms => new Promise(r => setTimeout(r, ms));

let crawler_data = {};
let category_id = null;
let mutex_lock = true;
let prod_count = null;


function show(all_data){
    let shower = document.getElementById(PROD_SHOWER_ID);
    for (let id in all_data){
        let tr = get_table_element(all_data[id]);
        shower.appendChild(tr);
    }
}


function get_table_element(data){
    let tr = document.createElement("tr");
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
    return tr
}


function get_id(data){
    // return data.Id;
    return data.Id
}


function get_data(cid, pid, data){
    let url = PROD_URL.replace(REPLACE_CATEGORY, cid).replace(REPLACE_PROD, pid)
    let e = {
        "nick": data.Nick,
        "pic": data.Pic,
        "seq": data.Seq,
        "price": data.Price,
        "url": url,
    };
    return e;
}


function intersection(){
    // 交集
    let result = {};
    let temp;
    for (let cid in crawler_data){
        console.log(`cid: ${cid}`);
        temp = {};
        if (Object.keys(result).length === 0){
            for (let i = 0; i < crawler_data[cid].length; i = i + 1){
                let pid = get_id(crawler_data[cid][i]);
                result[pid] = get_data(cid, pid, crawler_data[cid][i]);
            }
            console.log(result);
        }else{
            for (let i = 0; i < crawler_data[cid].length; i = i + 1){
                let pid = get_id(crawler_data[cid][i]);
                if (pid in result){
                    temp[pid] = get_data(cid, pid, crawler_data[cid][i]);
                }
            }
            console.log(temp);
            result = temp;
        }
    }
    return result;
}


function union(){
    // 聯集
    // TODO: 需要實作
}


function import_js(url){
    let script = document.createElement("script");
    script.type = 'text/javascript';
    script.src = url;
    document.getElementsByTagName('head')[0].appendChild(script);
}


function api_prod_callback(data){
    for (let j = 0; j < data.length; j = j + 1){
        if (!(category_id in crawler_data)){
            crawler_data[category_id] = [];
        }
        crawler_data[category_id].push(data[j]);
    }
}


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


function api_prod_count_callback(count){
    prod_count = count;
    count = Math.ceil(count / PROD_LIMIT)
    for (let i = 0; i < count ; i = i + 1){
        let prod_url = null;

        if (i != count -1){
            prod_url = PROD_API_URL.replace(REPLACE_CATEGORY, category_id);
        }else{
            prod_url = PROD_API_URL_RELEASE.replace(REPLACE_CATEGORY, category_id);
        }
        import_js(prod_url);
    }
}


function pchome_crawler(id){
    category_id = id;
    let prod_count_url = PROD_COUNT_API_URL.replace(REPLACE_CATEGORY, category_id);
    import_js(prod_count_url);
}


// Reference: https://shunnien.github.io/2017/07/03/Get-Query-String-Parameters-with-JavaScript/
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


async function run(){
    const all_id_array = query_string(window.location).all_id_array.split(",");  // 嘗試從 url param 取得
    for (let i = 0; i < all_id_array.length; i = i + 1){
        if (i == 0){
            console.log("Get all_id_array from url param");
        }
        while (true){
            if (mutex_lock){
                mutex_lock = false;
                pchome_crawler(all_id_array[i]);
                break;
            }
            await sleep(SLEEP_MS);
        }
    }

    // wait
    while (true){
        if (mutex_lock){
            break;
        }
        await sleep(SLEEP_MS);
    }

    // 全部處理完時要做的事
    result = intersection();
    show(result);
}

run();
