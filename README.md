# webhelperextension
Automate your browser!

This is a Chrome extension that allows you to automate clicking, typing, and entering data into websites. It was specifically designed to efficiently download many bank transaction data files (bank account, credit card) from a bunch of different bank website but it could be used for a variety of similar tasks. It generally works well even if you launch an automation task and then continue using Chrome for other stuff in another tab while the automation continues. 

Note: A key benefit of using this approach for downloading things from banks is that using your trusted web browser session usually allows entry into bank websites without being stopped for 2-factor authentication requests. Using many other automation approaches (e.g. webdriver) involve using separate "clean" web browsing contexts for automation which most bank websites will not trust and will require 2-factor auth every time you try to run automation with them. Disclaimer: make sure you are not breaking your bank website's terms of service by using automation to log into their website or at least understand that they can take revoke your online login privileges or shutdown your account if they catch you. All data entry fields are stored in plaintext locally within your webbrower's local storage area which is not secure from other people who have access to your computer. Only use this automation for banks if you keep your computer session secure from anybody who you don't want logging into your bank.

Instructions to use:

To add this extension to your web browser follow these steps:
* Clone this repo. 
* Add to chrome by navigating to chrome://extensions/ clicking "Developer mode" and then "Load unpacked." 
* Specify this repo's folder. You now have the extension!

You should now have a "W" available in the upper-right corner of Chrome.

To begin "recording" actions for later automation, browse to any website. Hover your mouse over any part of the website and then press the following key combination "Crtl-alt-w" This will bring a prompt window up. You now have the opportunity to choose from 3 types of actions to automate:
* If you had selected a text field, you may enter text into the prompt which will be entered.
* If you had hovered over a clickable element, you may leave the prompt blank to click it.
* If you had hovered over a select dropdown, you may use any text within the option and enter it. webhelperextension will search all options and find the first matching one and then select it.

You may record as many steps as you want. If you want to review what you just recorded, click the "W" and scroll to the bottom. You should see the most recent step you recorded. You can delete it if you accidentally recorded the step or if you need to redo it. You can click a different step if you want to begin recording somewhere else within your automation sequence. Ctrl-alt-w will always push the current step down and insert a new step at that location.

## Geeky details

webhelperextension explores the HTML DOM surrounding each element that the user wants clicked or input entered. It records both a screenshot of the element (for UI purposes) and it records any nearby text nodes or nodes with unique HTML IDs so that it will be able to reference the element later. For this reason, if the order of elements on the website change over time, it may be fooled into clicking the wrong thing. While it is usually pretty good about consistently finding correct elements, if you ever notice that it is clicking on incorrect elements, you can delete and re-add the step and it will usually fix the problem on subsequent runs.
