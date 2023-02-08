const ADD_URL_SUBMIT_ID = "add_url_submit";
const URL_SHOWER_ID = "url_shower";
const URL_SHOWER_REFRESH_ID = "url_shower_refresh";
const URL_SHOWER_CONTENT_ID = "url_shower_content";
const SEARCH_BUTTON_ID = "search_button";
const URL_INPUT_ID = "url_input";

// SearchResult 相關設定
const SEARCH_RESULT_VARIABLE_NAME = "all_id_array";

let all_url_array = [];

function url_delete_event(url){
    let index = all_url_array.indexOf(url);
    if (index !== -1){
        all_url_array.splice(index, 1);
        document.getElementById(URL_SHOWER_CONTENT_ID).children[index + 1].remove();
    }
}

function get_table_element(url){
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
    img.onclick = () => {url_delete_event(url)};

    td.appendChild(a);
    td.appendChild(img);
    tr.appendChild(td);
    return tr
}

function add_url_submit(){
    let url_shower_content = document.getElementById(URL_SHOWER_CONTENT_ID);

    if (url_shower_content !== null){
        let url_input = document.getElementById(URL_INPUT_ID);
        let url = url_input.value;
        url_input.value = "";

        if (all_url_array.indexOf(url) == -1){
            all_url_array.push(url);

            let tr = get_table_element(url);
            url_shower_content.appendChild(tr);
        }
        
    }
}

function url_shower_refresh(){
    let url_shower_content = document.getElementById(URL_SHOWER_CONTENT_ID);
    console.log("refresh");

    if (url_shower_content !== null){
        // 先 clear URL_SHOWER_REFRESH_ID 的 element
        for (let i = url_shower_content.children.length - 1; i > 0; i = i - 1){
            url_shower_content.children[i].remove();
        }

        // 加入 url
        for (let i = 0; i < all_url_array.length; i = i + 1){
            let url = all_url_array[i];
            let tr = get_table_element(url);
            url_shower_content.appendChild(tr);
        }
    }
}

function search_button(){
    let query = "";
    for (let i = 0; i < all_url_array.length; i = i + 1){
        let path_name = new URL(all_url_array[i]).pathname.split("/");
        let id = path_name[path_name.length - 1];
        if (query === ""){
            query += id;
        }
        else{
            query += `,${id}`;
        }
    }
    window.location.href = `SearchResult.html?${SEARCH_RESULT_VARIABLE_NAME}=${query}`;
}

/* 監聽事件 */

document.getElementById(ADD_URL_SUBMIT_ID).addEventListener("click", add_url_submit);
document.getElementById(URL_SHOWER_REFRESH_ID).addEventListener("click", url_shower_refresh);
document.getElementById(SEARCH_BUTTON_ID).addEventListener("click", search_button);
