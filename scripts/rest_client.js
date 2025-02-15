// noinspection JSUnresolvedReference

const search_endpoint = "https://images-api.nasa.gov/search?q={search}&page={page}&page_size={pageSize}&media_type=image";

const _target = document.querySelector("#searchContent");
const _status = document.querySelector("#statusContainer");
const _statusTitle = document.querySelector("#statusTitle");
const _statusDescription = document.querySelector("#statusDescription");

const _overlay = document.querySelector("#metaDataOverlay");
const _searchInfoContEle = document.querySelector("#searchInfoContainer");
const _returnTopEle = document.querySelector("#returnToTop");

const _searchInfoEle = document.querySelector("#searchDetails");

const _nextEle = document.querySelector("#nextImg");
const _prevEle = document.querySelector("#prevImg");
const _pageInfo = document.querySelector("#pageInfo");

const _submitBtn = document.querySelector("#submitBtn");
const _searchTxt = document.querySelector("#searchTxt");
const _pageSizeCombo = document.querySelector("#pageSize");

const _metaClose = document.querySelector("#metaClose");
const _metaTitle = document.querySelector("#metaTitle");
const _metaImgCont = document.querySelector("#metaImgCont");

const _metaDescription = document.querySelector("#metaDescriptionContent");

const _metaCenter = document.querySelector("#metaCenter");
const _metaDate = document.querySelector("#metaDate");
const _metaKeywords = document.querySelector("#metaKeywords");
const _metaMediaType = document.querySelector("#metaType");

let _currPage = -1;
let _searchQuery = "";
let _pageSize = -1;

function search_request(query, pageSize, page) {
    let final_url = search_endpoint.replace("{search}", query).replace("{pageSize}", pageSize).replace("{page}", page);
    search_url(final_url);
}

function search_url(url) {

    const queryS = url.substring(url.indexOf("?"));
    getUrlParameters(queryS);
    window.history.replaceState("", "", "?q=" + _searchQuery + "&page=" + _currPage + "&page_size=" + _pageSize + "&media_type=image");
    _searchTxt.value = _searchQuery;
    _pageSizeCombo.value = _pageSize;
    getResponse(url);
}

async function getResponse(requestUrl) {

    showStatus("Loading", "Searching for '" + _searchQuery + "'");
    enableSearch(false);
    _target.innerHTML = "";

    const options = {
        method: 'GET',
        headers: {
            "Accept-Encoding": "br, gzip"
        }
    };

    fetch(requestUrl, options)
        .then(response => {
            switch (response.status) {
                case 200:
                    const contentType = response.headers.get('content-type');
                    if (contentType && contentType.includes('application/json')) {
                        return response.json();
                    } else {
                        handleError('Response is not JSON')
                        break;
                    }
                case 400:
                    handleError('400 - Bad request')
                    break;
                case 404:
                    handleError('404 - The requested resource does not exist')
                    break;
                case 500:
                case 502:
                case 503:
                case 504:
                    handleError('500 - Internal server error')
                    break;
            }
            // if (!response.ok) {
            //     handleError('Invalid network response')
            // }
            // const contentType = response.headers.get('content-type');
            // if (contentType && contentType.includes('application/json')) {
            //     return response.json();
            // } else {
            //     handleError('Response is not JSON')
            //     throw new Error('Response is not JSON');
            // }
        }).then(json => {
            parseJson(json);
        }).catch(console.error);
}

function parseJson(json) {

    let collection = json.collection;
    let results = collection.metadata.total_hits;
    let items = collection.items;
    let links = collection.links;
    let nextUrl = "";
    let prevUrl = "";

    if (items.length === 0) {
        showStatus("Search Error", "No items found for query '" + _searchQuery + "'");
        enableSearch(true);
        return;
    }

    if (links != null) {
        for (let i = 0; i < links.length; i++) {
            let link = links[i];
            let href = link.href;
            let rel = link.rel;

            if (rel === "next")
                nextUrl = href.replace("http://", "https://");

            if (rel === "prev")
                prevUrl = href.replace("http://", "https://");
        }
    }

    for(let i=0; i < items.length; i++) {
        let item = items[i];
        let data = item.data[0];
        let title = data.title;
        let description = data.description;
        let center = data.center;
        let created = new Date(data.date_created).toLocaleDateString();
        let keywords = data.keywords;
        let mediaType = data.media_type;
        let thumbSrc = "";
        let thumbWidth = 200;
        let thumbHeight = 200;
        let origSrc = "";
        let mediumSrc = "";
        let largeSrc = "";

        for(let index=0; index < item.links.length; index++) {
            let imageLink = item.links[index];
            let type = imageLink.rel;
            switch (type) {
                case "canonical":
                    origSrc = imageLink.href.replace("http://","https://");
                    break;
                case "alternate":
                    if(imageLink.href.includes("~medium"))
                        mediumSrc = imageLink.href.replace("http://","https://");
                    if(imageLink.href.includes("~large"))
                        largeSrc = imageLink.href.replace("http://","https://");
                    break;
                case "preview":
                    thumbSrc = imageLink.href.replace("http://","https://");
                    break;
            }
        }

        const titleEle = document.createElement("div");
        const thumbEle = document.createElement("img");
        const resultCont = document.createElement("div");
        resultCont.className = "searchResult";
        resultCont.onclick = function() {
            // Launch full details overlay
            showMetaOverlay();
            _metaTitle.innerHTML = "<h2>" + title + "</h2>";

            const metaImgTmp = document.createElement("img");

            if(mediumSrc !== "")
                metaImgTmp.src = mediumSrc;
            else if(largeSrc !== "")
                metaImgTmp.src = largeSrc;
            else if(origSrc !== "")
                metaImgTmp.src = origSrc;

            metaImgTmp.className = "metaImg";

            _metaImgCont.innerHTML = "";
            _metaImgCont.appendChild(metaImgTmp);

            _metaDescription.innerHTML = description;
            _metaCenter.textContent = center;
            _metaDate.textContent = created;
            _metaKeywords.textContent = keywords;
            _metaMediaType.textContent = mediaType;
        }
        titleEle.textContent = title;
        titleEle.className = "resultTitle";

        if(thumbSrc !== "")
            thumbEle.src = thumbSrc;
        else if(mediumSrc !== "")
            thumbEle.src = mediumSrc;
        else if(largeSrc !== "")
            thumbEle.src = largeSrc;
        else if(origSrc !== "")
            thumbEle.src = origSrc;

        thumbEle.loading = "lazy";
        thumbEle.width = thumbWidth;
        thumbEle.height = thumbHeight;
        thumbEle.alt = "Retrieved image " + (i + 1) + " of " + items.length;
        resultCont.appendChild(thumbEle);
        resultCont.appendChild(titleEle);
        _target.appendChild(resultCont);
    }

    let pages = Math.ceil(results / _pageSize);
    let startResult = ((_currPage - 1) * _pageSize) + 1;
    let endResult = Math.min(results, _currPage * _pageSize);

    _metaClose.onclick = function () {
        _metaImgCont.innerHTML = "";
        _metaTitle.textContent = "";
        _metaDescription.innerHTML = "";
        _metaCenter.textContent = "";
        _metaDate.textContent = "";
        _metaKeywords.textContent = "";
        _metaMediaType.textContent = "";
        showTarget();
    }

    _searchInfoEle.innerHTML = "Showing results " + startResult + " to " + endResult + " of " + results + " results for query <span class='searchTerm'>" + _searchQuery + "</span>";
    _pageInfo.innerHTML = "Page " + _currPage + " of " + pages;

    _nextEle.onclick = function() {
        search_url(nextUrl);
    }
    _prevEle.onclick = function() {
        search_url(prevUrl);
    }
    _nextEle.style.visibility = (nextUrl === "") ? "hidden" : "visible";
    _prevEle.style.visibility = (prevUrl === "") ? "hidden" : "visible";

    showTarget();
    enableSearch(true);
}

function showTarget() {
    _overlay.style.display = "none";
    _target.style.display = "grid";
    _status.style.display = "none";
    _searchInfoContEle.style.display = "flex";
    _returnTopEle.style.display = "flex";
}

function showStatus(statusTitle, statusDescription) {
    _overlay.style.display = "none";
    _target.style.display = "none";
    _status.style.display = "flex";
    _searchInfoContEle.style.display = "none";
    _returnTopEle.style.display = "none";
    _statusTitle.textContent = statusTitle;
    _statusDescription.textContent = statusDescription;
}

function showMetaOverlay() {
    _overlay.style.display = "flex";
    _target.style.display = "none";
    _status.style.display = "none";
    _searchInfoContEle.style.display = "none";
    _returnTopEle.style.display = "none";
}

function searchFn() {
    let searchVal = _searchTxt.value;
    let _pageSize = _pageSizeCombo.value;
    if(searchVal !== "") {
        search_request(searchVal, _pageSize, 1);
    } else {
        handleError('No search value entered')
    }
}

function enableSearch(enable) {
    if(enable) {
        _submitBtn.removeAttribute("disabled");
        _searchTxt.removeAttribute("disabled");
        _pageSizeCombo.removeAttribute("disabled");
    } else {
        _submitBtn.setAttribute("disabled", "disabled");
        _searchTxt.setAttribute("disabled", "disabled");
        _pageSizeCombo.setAttribute("disabled", "disabled");
    }
}

function getUrlParameters(queryString) {
    let params = new URLSearchParams(queryString);
    _currPage = params.get("page");
    _searchQuery = params.get("q");
    _pageSize = params.get("page_size");
}

function handleError(errorDescription) {
    showStatus("Error", errorDescription);
}

_searchTxt.addEventListener("keypress", function(event) {
    if (event.key === "Enter") {
        event.preventDefault();
        searchFn();
    }
});



window.onload=function() {
    getUrlParameters(window.location.search);
    if(_searchQuery != null) {
        if(_pageSize == null)
            _pageSize = 100;

        if(_currPage == null)
            _currPage = 1;

        search_request(_searchQuery, _pageSize, _currPage);
    }
}
