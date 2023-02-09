const ELEMENT_QUERY = "dl#MenuContainer li";
const DELAY = 3000;

var all_id_array = [];

console.log("Pchome multi category search load success!!");

setTimeout(function(){
    let all_category = document.querySelectorAll(ELEMENT_QUERY);

    for (let i = 0; i < all_category.length; i = i + 1){
        let checkbox = document.createElement("input");
        checkbox.type = "checkbox";

        let url = all_category[i].children[0].href;
        let path_name = new URL(url).pathname.split("/");
        let id = path_name[path_name.length - 1];
        checkbox.onchange = () => {
            let index = all_id_array.indexOf(id);
            if (index == -1){
                all_id_array.push(id);
            }else{
                all_id_array.splice(index, 1);
            }
            console.log(all_id_array);
        };
        all_category[i].insertAdjacentElement("afterbegin", checkbox);
    }
}, DELAY);


chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
      console.log(sender.tab ?
                  "from a content script:" + sender.tab.url :
                  "from the extension");
      if (request.greeting === "hello")
        sendResponse({"data": all_id_array});
    }
  );