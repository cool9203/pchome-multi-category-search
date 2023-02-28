const ELEMENT_QUERY = "dl#MenuContainer li";
const TOP_PROD_QUERY = "div[_id]";
const PROD_QUERY = "dd[_id]";
const DELAY = 3000;
const OPACITY = 0.1;

let PORT = chrome.runtime.connect();

console.log("Pchome multi category search load success!!");

function init(){
    console.log("init");
    let all_category = document.querySelectorAll(ELEMENT_QUERY);

    for (let i = 0; i < all_category.length; i = i + 1){
        let url = all_category[i].children[0].href;
        let path_name = new URL(url).pathname.split("/");
        let id = path_name[path_name.length - 1];

        let checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.id = `__${id}`;
        
        checkbox.onchange = () => {
            let e = document.getElementById(`__${id}`);
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

    PORT.postMessage({url: new URL(window.location.pathname, window.location.origin).href,
        action: "get"
    });
}


function run(result){
    console.log("run");
    let all_query = [TOP_PROD_QUERY, PROD_QUERY];
    for (let query_index = 0; query_index < all_query.length; query_index = query_index + 1){
        let query = all_query[query_index];
        let nodes = document.querySelectorAll(query);
        for (let node_index = 0; node_index < nodes.length; node_index = node_index + 1){
            let node = nodes[node_index];
            let id = node.getAttribute("_id");
            if (Object.keys(result).length > 0){
                if (id in result){
                    node.style.opacity = 1.0;
                }else{
                    node.style.opacity = OPACITY;
                }
            }else{
                node.style.opacity = 1.0;
            }
        }
    }
    
    console.log("end");
}


function recheck(all_id){
    let nodes = document.querySelectorAll("input[id^='__'][type=checkbox]");
    for (let i = 0; i < nodes.length; i = i + 1){
        let id = nodes[i].id.slice(2);
        if (id in all_id){
            nodes[i].checked = true;
        }
    }
}


PORT.onMessage.addListener(function(message) {
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


setTimeout(init, DELAY);
