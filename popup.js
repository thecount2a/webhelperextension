document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('exportimport').addEventListener('click', function () {
        chrome.runtime.sendMessage({ command: 'exportimportwindow' });
        window.close();
    });
    document.getElementById('play').addEventListener('click', function () {
        chrome.runtime.sendMessage({ command: 'play' });
        window.close();
    });
    document.getElementById('stop').addEventListener('click', function () {
        chrome.runtime.sendMessage({ command: 'stop' });
        window.close();
    });
    document.getElementById('playone').addEventListener('click', function () {
        chrome.runtime.sendMessage({ command: 'playone' });
        window.close();
    });
    document.getElementById('playall').addEventListener('click', function () {
        chrome.runtime.sendMessage({ command: 'playall' });
        window.close();
    });
});


var myApp = angular.module("my-app", []);

myApp.controller("PopupCtrl", async function($scope, $http){
    $scope.updateSteps = async function() {
        let result = await sendMessageToBackground({command: 'getsteps'});
        console.log(result);
        $scope.steps = result.steps;
        if (!$scope.steps)
        {
            $scope.steps = [];
        }
        $scope.steps.push({});
        $scope.selectedStep = result.currentStep;
        $scope.$digest();
    }
    await $scope.updateSteps();

    $scope.clickX = async function(num) {
        // Don't delete the last one (placeholder) since background script doesn't even know about it
        if (num == $scope.steps.length - 1)
        {
            return;
        }
        if (confirm("Are you sure you want to delete this step?"))
        {
            let result = await sendMessageToBackground({command: 'deletestep', stepNum: num});
            if (result.success)
            {
                await $scope.updateSteps();
            }
        }
    }

    $scope.selectStep = async function(num) {
        let result = await sendMessageToBackground({command: 'selectstep', stepNum: num});
        if (result.success)
        {
            $scope.selectedStep = num;
            $scope.$digest();
        }
    }

  }
);
