document.addEventListener('DOMContentLoaded', function () {

    let fileChooser = document.getElementById("filechooser");
    fileChooser.addEventListener('change', function () {
        var file = fileChooser.files[0];
        var reader = new FileReader();
        reader.onload = (function(theFile) {
            chrome.runtime.sendMessage({ command: 'importdata', contents: theFile.target.result });
        });
        reader.readAsText(file);
        document.getElementById("filechooserform").reset();
    });

    document.getElementById('export').addEventListener('click', function () {
        chrome.runtime.sendMessage({ command: 'exportdata' });
    });
});
