/*
 Copyright 2014 Delving BV, Rotterdam, Netherlands

 This program is free software: you can redistribute it and/or modify
 it under the terms of the GNU General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.

 This program is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU General Public License for more details.

 You should have received a copy of the GNU General Public License
 along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

'use strict';

var Schemaleon = angular.module('Schemaleon');

/**
 * CommunityController:
 * Activity log, chat, and document statistics
 *
 * @Author Gerald de Jong <gerald@delving.eu>
 * @Author Eric van der Meulen <eric@delving.eu>
 */

Schemaleon.controller(
    'CommunityController',
    function ($rootScope, $scope, $location, $anchorScroll, $cookieStore, $timeout, Statistics, Person) {

        $rootScope.checkLoggedIn();

        /** STATISTICS *******************************************************************************************/

        /**
         * Builds a list of log entries using the Statistics service for display in the Activity log on dashboard.html
         * Makes use of the Person service to associate recognizable person information based on the user id. 
         */
        Statistics.getLogEntries(function (entries) {
            $scope.logEntries = _.sortBy(entries, function (val) {
                return -val.TimeStamp;
            });

            // find unique user id's and map them. then fetch Person Profile for display of email
            var userIds = _.uniq(_.map($scope.logEntries, function(logEntry){
                return logEntry.Who;
            }));
            _.each(userIds, function(id){
                Person.getUser(id, function(user) {
                    _.each($scope.logEntries, function(element) {
                        if (id == element.Who) {
                            element.userView = user;
                        }
                    });
                });
            });
        });
        
        /**
         * Triggers a choosePath() link function to the user page
         * Used in the Activity log table to create links with the user's email addy or identifier
         * @param {Object} entry
         * @return {Function} choosePath
         */
        $scope.logEntryWho = function (entry) {
            $scope.choosePath('/people/user/' + entry.Who);
        };

        /**
         * Triggers a choosePath() link function to the activity based on the entry.Op string
         * @param {Object} entry
         * @return {Function} choosePath
         */
        $scope.logEntryDetail = function (entry) {
            var path = null;
            switch (entry.Op) {
                case 'Authenticate':
                    break;
                case 'TranslateTitle':
                case 'TranslateDoc':
                case 'TranslateLabel':
                    path = '/lang/' + entry.Lang;
                    break;
                case 'SaveGroup':
                    path = '/people/group/' + entry.Identifier;
                    break;
                case 'AddUserToGroup':
                case 'RemoveUserFromGroup':
                    path = '/people/group/' + entry.GroupIdentifier;
                    break;
                case 'AddVocabularyEntry':
                    path = '/vocab/' + entry.Vocabulary;
                    break;
                case 'SaveDocument':
                    // todo: not entirely sure this works yet
                    if (entry.GroupIdentifier) {
                        path = '/primary/' + entry.SchemaName + '/' + entry.GroupIdentifier + '/' + entry.Identifier + '/edit';
                    }
                    else {
                        path = '/shared/' + entry.SchemaName + '/' + entry.Identifier + '/edit';
                    }
                    break;
            }
            if (path) {
                $scope.choosePath(path);
            }
        };

        /** CHAT ***********************************************************************************************/

        var chatPollPromise;
        $scope.chatMessage = '';
        $scope.chatMessageSend = false;
        $scope.chatMessageList = [];
        $scope.showChat = false;
        $scope.toggleChat = function () {
            $scope.showChat = !$scope.showChat;
        };

        /**
         * Sends new chat message and appends it to the message list or only retrieves the list if no message is sent
         * Makes use of the Person service
         */
        function chatPoll() {
            // send the message, retrieve the messageList and reset chat variables
            if ($scope.chatMessageSend) {
                Person.publishChatMessage($scope.chatMessage, function (messageList) {
                    $scope.chatMessageSend = false;
                    $scope.chatMessage = '';
                    $scope.chatMessageList = messageList;
                });
            }
            // just retrieve the messageList
            else {
                Person.publishChatMessage('', function (messageList) {
//                    console.log('scope', _.size($scope.chatMessageList));
//                    console.log('server', _.size(messageList));
                    if( _.size(messageList) > _.size($scope.chatMessageList)) {
                        console.log('new message');
                    }
                    $scope.chatMessageList = messageList;
                });
            }
            // scroll to the bottom of the chat nessage list
            $rootScope.scrollTo({element:'#message-list', direction: 'down'});
            // check for new message every x seconds
            chatPollPromise = $timeout(chatPoll, 5000);
        }

        // poll on controller load
        //        chatPoll();

        /**
         * Triggers chatPoll() when user enters new chat message in chat input field
         * Triggered by pressing of button or the ENTER key via chatEnter directive
         * @param {String} chatMessage
         */
        $scope.chatSend = function(chatMessage) {
            $scope.chatMessage = chatMessage;
            if (chatPollPromise) {
                $timeout.cancel(chatPollPromise);
                chatPollPromise = null;
            }
            $scope.chatMessageSend = true;
            chatPoll();
        };

        function initChangeProfile() {
            $scope.changeProfile = angular.copy($scope.user.Profile);
        }
        initChangeProfile();

        $scope.$watch("changeProfile", function(changeProfile) {
            if (!changeProfile) return;
            var userProfile = $scope.user.Profile || {};
            changeProfile.disabled =
                userProfile.FirstName == changeProfile.FirstName &&
                userProfile.LastName == changeProfile.LastName &&
                userProfile.EMail == changeProfile.EMail;
        }, true);

        $scope.doChangeProfile = function() {
            var profile = {
                FirstName: $scope.changeProfile.FirstName,
                LastName: $scope.changeProfile.LastName,
                EMail: $scope.changeProfile.EMail
            };
            Person.changeProfile(profile, function (user) {
                if (user) $scope.user = user;
                initChangeProfile();
            });
        };

        function initChangePassword() {
            $scope.changePassword = { };
        }
        initChangePassword();

        $scope.$watch("changePassword", function(changePassword) {
            if (changePassword) changePassword.disabled =
                !changePassword.CurrentPassword || !changePassword.NewPassword ||
                    changePassword.NewPassword != changePassword.NewPasswordVerify;
        }, true);

        $scope.doChangePassword = function() {
            Person.changePassword($scope.changePassword, function(user) {
                if (user) $scope.user = user;
                initChangePassword();
            });
        };
    }
);

