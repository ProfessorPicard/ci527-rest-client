/**
 * All constant variables, mostly page elements that need to be accessed via javascript
 */
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

/**
 * Standard variables that need to be modified
 */
let _currPage = -1;
let _searchQuery = "";
let _pageSize = -1;
let _errorCode = 0;

/**
 * Performs a search request using a Query, Page Size and Page to create a url for the API search.
 * Usually used when performing a search from the search box.
 * @param query The query to be searched
 * @param pageSize The results to be displayed per page
 * @param page The page of results to retrieve
 */
function search_request(query, pageSize, page) {
    let final_url = search_endpoint.replace("{search}", query).replace("{pageSize}", pageSize).replace("{page}", page);
    search_url(final_url);
}

/**
 * Performs a search of the API using a pre generated URL.
 * Usually used when fetching the next and previous page URL from response data.
 * @param url The final search url to be used for the API
 */
function search_url(url) {

    const queryS = url.substring(url.indexOf("?"));
    getUrlParameters(queryS);
    window.history.replaceState("", "", "?q=" + _searchQuery + "&page=" + _currPage + "&page_size=" + _pageSize + "&media_type=image");
    _searchTxt.value = _searchQuery;
    _pageSizeCombo.value = _pageSize;
    getResponse(url);
}

/**
 * Performs an async fetch request of the URL created from our search_url function.
 * @param requestUrl The url to get a fetch response from
 * @returns {Promise<void>} The future result promise (not usually used, data is parsed separately)
 */
async function getResponse(requestUrl) {

    showStatus("Loading", "Searching for '" + _searchQuery + "'");
    enableSearch(false);
    _target.innerHTML = "";

    //Create headers to be sent to the API server.
    // Added this to try to force text compression on results to improve response times.
    //It did not work, the API does not support text compression.
    const options = {
        method: 'GET',
        headers: {
            "Accept-Encoding": "br, gzip"
        }
    };

    //Fetch function that gets the response from the API and processes the result accordingly.
    fetch(requestUrl, options)
        .then(response => {
            _errorCode = response.status;
            switch (response.status) {
                //If the response is good, check we have valid json and return it if so
                case 200:
                    const contentType = response.headers.get('content-type');
                    if (contentType && contentType.includes('application/json')) {
                        return response.json();
                    } else {
                        showStatus('Error', 'Response is not JSON');
                        break;
                    }
                // If the result is 400 return the response json even if there is none.
                // This is so I can display the cause of the 400 response,
                // mainly because the API only allows results upto 10000 to be retrieved,
                // and I want to notify the user of this.
                case 400:
                    return response.json();
                case 404:
                    showStatus('Error 404', 'The requested resource does not exist');
                    break;
                case 500:
                case 502:
                case 503:
                case 504:
                    showStatus('Error 500', 'Internal server error');
                    break;
            }
            //Enable the search again so you aren't stuck on an error page
            enableSearch(true);
        }).then(json => {

            //Send the received json to the appropriate function

            if(_errorCode === 200)
                parseJson(json);

            if(_errorCode === 400)
                displayBadRequestReason(json);

        }).catch(console.error);
}

/**
 * Displays the reason for a 400 bad request response.
 * This is mainly to display the max 10000 results error that the API imposes without saying anything.
 * @param json The json returned along with the 400 response code (can be null)
 */
function displayBadRequestReason(json) {
    if(json.reason != null)
        showStatus('Error 400', json.reason);
    else
        showStatus('Error 400', 'Bad request');

    enableSearch(true);
}

/**
 * Parses valid json returned by a 200 status code and adds it all to the webpage
 * @param json The json response returned along with a valid 200 status code
 */
function parseJson(json) {
    let collection = json.collection;
    let results = Math.min(collection.metadata.total_hits, 10000);
    let items = collection.items;
    let links = collection.links;
    let nextUrl = "";
    let prevUrl = "";

    //If there's nothing returned display 0 results found and return out of the function
    if (items.length === 0) {
        showStatus("Search Error", "No items found for query '" + _searchQuery + "'");
        enableSearch(true);
        return;
    }

    //Retrieves any pre generated next and previous page urls sent by the API
    //Also replaces any http urls with https for added security
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

    //For each result found, parse the result and add it to the webpage
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

        //For each image found in the result, get the url and replace http with https
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

        //create the result element along with the title and image thumbnail
        const titleEle = document.createElement("div");
        const thumbEle = document.createElement("img");
        const resultCont = document.createElement("div");
        resultCont.className = "searchResult";
        resultCont.tabIndex = 0;

        //add mouse on click handler to the result to open metadata
        resultCont.onclick = function() {
            updateMeta();
        }

        //add keyboard keypress handler to the result to open metadata when enter is pressed.
        //Mainly useful for accessibility features such as tabbing through results and using screen readers
        resultCont.addEventListener("keypress", function(event) {
            if (event.key === "Enter") {
                event.preventDefault();
                updateMeta();
            }
        });

        //updates the metadata with the selected result
        function updateMeta() {
            // Launch full details overlay
            showMetaOverlay();
            _metaTitle.innerHTML = "<h2>" + title + "</h2>";

            let metaImgTmp = document.createElement("img");

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

        //Gets the smallest image possible starting with thumbnails and working upwards.
        //Fixes errors when the result didn't contain a thumbnail and only a larger image
        if(thumbSrc !== "")
            thumbEle.src = thumbSrc;
        else if(mediumSrc !== "")
            thumbEle.src = mediumSrc;
        else if(largeSrc !== "")
            thumbEle.src = largeSrc;
        else if(origSrc !== "")
            thumbEle.src = origSrc;

        //If the current index of the result is higher than 10, lazy load the images.
        //This enables the first 10 images to be loaded faster as lazy loading happens later on in the dom cycle.
        //This improved the lighthouse score for Largest Contentful Paint from 4s to 0.4s
        if(i > 10)
            thumbEle.loading = "lazy";

        thumbEle.width = thumbWidth;
        thumbEle.height = thumbHeight;
        //Add alt text for screen readers to know what item they are on
        thumbEle.alt = "Retrieved image " + (i + 1) + " of " + items.length;
        resultCont.appendChild(thumbEle);
        resultCont.appendChild(titleEle);
        _target.appendChild(resultCont);
    }

    //Create the values for the page data and the amount of results
    let pages = Math.ceil(results / _pageSize);
    let startResult = ((_currPage - 1) * _pageSize) + 1;
    let endResult = Math.min(results, _currPage * _pageSize);

    //Fixes bug where you could page to results higher than 10000.
    //Clears the provided next page URL if you are on the last page of results.
    //The API still provides a url for the next results but won't action it.
    if(_currPage == pages)
        nextUrl = "";

    //add mouse on click handler to the close metadata button to close metadata
    _metaClose.onclick = function () {
        closeMeta();
    }

    //add keyboard keypress handler to the close metadata button to close metadata when enter is pressed.
    //Mainly useful for accessibility features such as tabbing through results and using screen readers
    _metaClose.addEventListener("keypress", function (event){
        if (event.key === "Enter") {
            event.preventDefault();
            closeMeta();
        }
    });

    //closes the metadata "screen" and resets all the fields to blank ready for the next result
    function closeMeta() {
        _metaImgCont.innerHTML = "";
        _metaTitle.textContent = "";
        _metaDescription.innerHTML = "";
        _metaCenter.textContent = "";
        _metaDate.textContent = "";
        _metaKeywords.textContent = "";
        _metaMediaType.textContent = "";
        showTarget();
    }

    //Adds all the page data and result data to the search info bar
    _searchInfoEle.innerHTML = "Showing results " + startResult + " to " + endResult + " of " + results + " results for query <span class='searchTerm'>" + _searchQuery + "</span>";
    _pageInfo.innerHTML = "Page " + _currPage + " of " + pages;

    //add mouse on click handler to the next button to goto the next page of results
    _nextEle.onclick = function() {
        search_url(nextUrl);
    }
    //add keyboard keypress handler to the next button to goto the next page of results when enter is pressed.
    //Mainly useful for accessibility features such as tabbing through results and using screen readers
    _nextEle.addEventListener("keypress", function(event) {
        if (event.key === "Enter") {
            event.preventDefault();
            search_url(nextUrl);
        }
    });

    //add mouse on click handler to the previous button to goto the previous page of results
    _prevEle.onclick = function() {
        search_url(prevUrl);
    }
    //add keyboard keypress handler to the previous button to goto the previous page of results when enter is pressed.
    //Mainly useful for accessibility features such as tabbing through results and using screen readers
    _prevEle.addEventListener("keypress", function(event) {
        if (event.key === "Enter") {
            event.preventDefault();
            search_url(prevUrl);
        }
    });

    //Sets the visibility of the previous and next buttons depending on if there is a URL present for them
    _nextEle.style.visibility = (nextUrl === "") ? "hidden" : "visible";
    _prevEle.style.visibility = (prevUrl === "") ? "hidden" : "visible";

    //Show the results and enable the search
    showTarget();
    enableSearch(true);
}


/**
 * Shows the results and search info divs and hides any other divs
 */
function showTarget() {
    _overlay.style.display = "none";
    _target.style.display = "grid";
    _status.style.display = "none";
    _searchInfoContEle.style.display = "flex";
    _returnTopEle.style.display = "flex";
}

/**
 * Shows the status div and hides any other divs. Displays a title and message to the user.
 * @param statusTitle Title of the status message
 * @param statusDescription Message text to be displayed
 */
function showStatus(statusTitle, statusDescription) {
    _overlay.style.display = "none";
    _target.style.display = "none";
    _status.style.display = "flex";
    _searchInfoContEle.style.display = "none";
    _returnTopEle.style.display = "none";
    _statusTitle.textContent = statusTitle;
    _statusDescription.textContent = statusDescription;
}

/**
 * Show the metadata overlay and hide the other divs
 */
function showMetaOverlay() {
    _overlay.style.display = "flex";
    _target.style.display = "none";
    _status.style.display = "none";
    _searchInfoContEle.style.display = "none";
    _returnTopEle.style.display = "none";
}

/**
 * Gets the search values entered by the user in the search area and performs a search-request with those values.
 */
function searchFn() {
    let searchVal = _searchTxt.value;
    let _pageSize = _pageSizeCombo.value;
    if(searchVal !== "") {
        search_request(searchVal, _pageSize, 1);
    } else {
        showStatus('Search Error', 'No search value entered')
    }
}

/**
 * Enables or disables the search area
 * @param enable Boolean value indicating whether the search area should be displayed
 */
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

/**
 * Gets the URL parameters supplied in the page url.
 * This is used to enable a search to be performed by entering the search terms in the url.
 * This enables proper SEO by allowing web address to be pointed to searches
 * and for lighthouse and validation services to be able to actually validate search data as it is dynamically generated.
 * @param queryString
 */
function getUrlParameters(queryString) {
    let params = new URLSearchParams(queryString);
    _currPage = params.get("page");
    _searchQuery = params.get("q");
    _pageSize = params.get("page_size");
}

/**
 * Adds keypress event listener to the search text box. performs search when enter is pressed.
 */
_searchTxt.addEventListener("keypress", function(event) {
    if (event.key === "Enter") {
        event.preventDefault();
        searchFn();
    }
});

/**
 * Adds keypress event listener to the search button. performs search when enter is pressed.
 */
_submitBtn.addEventListener("keypress", function (event) {
    if (event.key === "Enter") {
        event.preventDefault();
        searchFn();
    }
});

/**
 * Gets url parameters and performs a search using those parameters when the page is loaded.
 */
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
