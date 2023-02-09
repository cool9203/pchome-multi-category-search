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

// 註冊滑鼠右鍵事件, 增加選項到右鍵選單裡
chrome.runtime.onInstalled.addListener(() => {
    // 一次性的創建一個右鍵選單項目
    chrome.contextMenus.create(SETTING.generate_page);
});

// 右鍵選單的選項, 增加點選產出功能事件
chrome.contextMenus.onClicked.addListener((info, tab)=>{
    // 確認點擊的項目 id 是 showImageUrl
    if (info.menuItemId !== SETTING.generate_page.id) { 
        return; 
    }
    console.log("產生報表");

    (async () => {
        const [tab] = await chrome.tabs.query({active: true, lastFocusedWindow: true});
        const response = await chrome.tabs.sendMessage(tab.id, {greeting: "hello"});
        // do something with response here, not outside the function
        console.log(response);
        let all_id_array = response.data;
        let query = "";
        for (let i = 0; i < all_id_array.length; i = i + 1){
            let id = all_id_array[i];
            if (query === ""){
                query += id;
            }
            else{
                query += `,${id}`;
            }
        }

        chrome.tabs.create({
            "url": `https://cool9203.github.io/pchome-multi-category-search/src/SearchResult.html?all_id_array=${query}`
        });
    })();
});