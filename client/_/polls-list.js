'use strict';

module.exports = function() {
    const lists = document.querySelectorAll('.polls-list');
    for(var i = 0; i < lists.length; ++i) {
        const list = lists.item(i);
        hijackAnchors(list);
    }

    function hijackAnchors(list) {
        const polls = list.querySelectorAll('.poll-item');
        for (var i = 0; i < polls.length; i++) {
            const anchor = polls[i].querySelector('.poll-item-button');
            const href = anchor.href;
            anchor.parentNode.removeChild(anchor);

            polls[i].addEventListener('click', function() {
                window.location = href;
            });
        }
    }
};
