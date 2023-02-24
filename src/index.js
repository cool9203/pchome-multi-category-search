const ADD_UNION_URL_SUBMIT = "add_union_url_submit";
const ADD_INTERSECTION_URL_SUBMIT = "add_intersection_url_submit";
const UNION_URL_SHOWER_CONTENT_ID = "union_url_shower_content";
const INTERSECTION_URL_SHOWER_CONTENT_ID = "intersection_url_shower_content";
const SEARCH_BUTTON_ID = "search_button";
const URL_INPUT_ID = "url_input";

// SearchResult 相關設定
const UNION_VARIABLE_NAME = "union";
const INTERSECTION_VARIABLE_NAME = "intersection";


/** 
 * 刪除 url event
 * @params {string} url 要刪除的 url 
 * @params {string} url_shower_content_id url 存在的物件 id
 */ 
function _url_delete_event(url, url_shower_content_id){
    let shower = document.getElementById(url_shower_content_id);
    for (let i = 0; i < shower.children.length; i = i + 1){
        if (shower.children[i].textContent == url){
            shower.children[i].remove();
            break;
        }
    }
}


/** 
 * 建立 table 元素
 * @params {string} url 元素的 url
 * @params {function} delete_event 元素的刪除事件
 */ 
function get_table_element(url, delete_event){
    let tr = document.createElement("tr");
    let td = document.createElement("td");

    let a = document.createElement("a");
    a.href = url;
    a.text = url;

    let img = document.createElement("img");
    img.src = "images/delete.png"; // 刪除鈕
    img.alt = "刪除該列網址";
    img.title = "刪除該列網址";
    img.classList.add("delete_img");
    img.onclick = () => {delete_event(url)};

    td.appendChild(a);
    td.appendChild(img);
    tr.appendChild(td);
    return tr
}


/** 
 * 新增 url event
 * @params {string} url_input_id 
 * @params {string} shower_content_id
 * @params {function} delete_event
 */ 
function _add_url_submit(url_input_id, shower_content_id, delete_event){
    let url_shower_content = document.getElementById(shower_content_id);

    if (url_shower_content !== null){
        let url_input = document.getElementById(url_input_id);
        let url = url_input.value;
        url_input.value = "";
        let tr = get_table_element(url, delete_event);
        url_shower_content.appendChild(tr);
    }
}


function _get_shower_content_url(shower_content_id){
    let url_array = [];
    let shower = document.getElementById(shower_content_id);
    for (let i = 0; i < shower.children.length; i = i + 1){
        url_array.push(shower.children[i].textContent);
    }
    return url_array;
}


function _get_url_id_string(url_array){
    let id_string = "";
    for (let i = 0; i < url_array.length; i = i + 1){
        let path_name = new URL(url_array[i]).pathname.split("/");
        let id = path_name[path_name.length - 1];
        if (id_string === ""){
            id_string += id;
        }
        else{
            id_string += `,${id}`;
        }
    }
    return id_string;
}


/** 
 * 轉跳到搜尋結果的頁面 event
 */ 
function search_button(){
    let union_id = _get_url_id_string(_get_shower_content_url(UNION_URL_SHOWER_CONTENT_ID));
    let intersection_id = _get_url_id_string(_get_shower_content_url(INTERSECTION_URL_SHOWER_CONTENT_ID));
    window.location.href = `SearchResult.html?${UNION_VARIABLE_NAME}=${union_id}&${INTERSECTION_VARIABLE_NAME}=${intersection_id}`;
}


/* 監聽事件 */
document.getElementById(ADD_UNION_URL_SUBMIT).addEventListener("click", 
    () => _add_url_submit(
        URL_INPUT_ID, 
        UNION_URL_SHOWER_CONTENT_ID, 
        (url) => _url_delete_event(
            url, 
            UNION_URL_SHOWER_CONTENT_ID
        )
    )
);
document.getElementById(ADD_INTERSECTION_URL_SUBMIT).addEventListener("click", 
    () => _add_url_submit(
        URL_INPUT_ID, 
        INTERSECTION_URL_SHOWER_CONTENT_ID, 
        (url) => _url_delete_event(
            url, 
            INTERSECTION_URL_SHOWER_CONTENT_ID
        )
    )
);
document.getElementById(SEARCH_BUTTON_ID).addEventListener("click", search_button);
