/* ==========================================================
 * OSCR v.1.0
 * https://github.com/delving/oscr/app/scripts/global.js
 *
 * ==========================================================
 * Copyright 2013 Delving B.V.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * ========================================================== */

var OSCR = angular.module('OSCR');

OSCR.controller(
    'PeopleController',
    function ($rootScope, $scope, $q, $location, Person, $timeout) {

        $rootScope.checkLoggedIn();

        $scope.administratorRole = 'Administrator';
        $scope.selectedGroup = {};
        $scope.chosenUser = null;
        $scope.groupFindUser = null;
        $scope.groupCreated = false;
        $scope.userAssigned = false;
        $scope.groupList = [];
        $scope.userList = [];
        $scope.roles = _.map(Person.roles, function (role) {
            return { name: role }
        });
        $scope.membership = $rootScope.user.Membership;

        $scope.populateGroup = function (group) {
            Person.getUsersInGroup(group.Identifier, function (list) {
                $scope.selectedGroup.userList = list;
            });
            $scope.selectedGroup.Identifier = group.Identifier;
            $scope.selectedGroup.Name = group.Name;
        };

        if ($scope.membership.Role == $scope.administratorRole) {
            if ($scope.membership.GroupIdentifier == 'OSCR') {
                Person.getAllGroups(function (list) {
                    $scope.groupList = list;
                });
                Person.getAllUsers(function(list) {
                    $scope.userList = list;
                });
            }
            else {
                Person.getGroup($scope.membership.GroupIdentifier, function(group) {
                    console.log("group", group);
                    $scope.populateGroup(group);
                })
            }
        }

        $scope.typeAheadUsers = function (query, onlyOrphans) {
            var search = query.toLowerCase();
            var selectedUsers = _.filter($scope.userList, function (user) {
                return user.Profile.firstName.toLowerCase().indexOf(search) >= 0 ||
                    user.Profile.lastName.toLowerCase().indexOf(search) >= 0;
            });
            // todo: splice when it gets too big
            if (!selectedUsers.length) {
                selectedUsers = $scope.userList;
            }
            return selectedUsers;

        };

        $scope.selectGroup = function(group) {
            $scope.populateGroup(group);
            $scope.groupChoice = '';
        };

        $scope.selectGroupFromUser = function(user) {
            Person.getGroup(user.Membership.GroupIdentifier, function(group) {
                $scope.populateGroup(group);
                $scope.groupFindUser = '';
            });
        };

        $scope.userToString = function (user) {
            if (!user) return '';
            return user.Profile.firstName + ' ' + user.Profile.lastName + ' <' + user.Profile.email + '>';
        };

        $scope.typeAheadGroups = function (query) {
            var search = query.toLowerCase();
            // create a list of groups matching the user input
            var selectedGroups = _.filter($scope.groupList, function (group) {
                return group.Name.toLowerCase().indexOf(search) >= 0;
            });
            // if no groups match the typed input then return all available groups
            if (!selectedGroups.length) {
                selectedGroups = $scope.groupList;
            }
            return selectedGroups;
        };

        $scope.groupToString = function (group) {
            if (!group) return '';
            return group.Name;
        };

        $scope.creatingGroup = false;
        $scope.addingUser = false;

        $scope.newGroupToggle = function () {
            $scope.creatingGroup = !$scope.creatingGroup;
            $scope.addingUser = false;
        };

        $scope.addUserToggle = function (role) {
            console.log(role);
            if (!role) {
                $scope.addingUser = false;
                return;
            }
            $scope.selectedGroup.Role = role;
            $scope.addingUser = true;
            $scope.creatingGroup = false;
        };

        $scope.createGroup = function () {
            var group = {
                Name: $scope.groupName,
                StreetAndNr: $scope.groupStreetAndNr,
                Zip: $scope.groupZip,
                City: $scope.groupCity,
                Description: $scope.groupDescription
            };
            // todo: make XML from the group and send that instead
            Person.saveGroup(group, function (groupObject) {
                $scope.groupCreated = true;
                $scope.groupName = '';
                $scope.groupStreetNameAndNr = '';
                $scope.groupZip = '';
                $scope.groupCity = '';
                $scope.groupDescription = '';
                $timeout(function () {
                    $scope.groupCreated = false;
                    $scope.creatingGroup = false;
                }, 4000);
                Person.getAllGroups(function (list) {
                    $scope.groupList = list;
                });
            });
        };

        $scope.assignUserToGroup = function () {
            Person.addUserToGroup(
                $scope.chosenUser.Identifier,
                $scope.selectedGroup.Role,
                $scope.selectedGroup.Identifier,
                function (xml) {
                    $scope.userAssigned = true;
                    $scope.chosenUser = null;
                    _.each($scope.groupList, function (group) {
                        if (group.Identifier === $scope.selectedGroup.Identifier) {
                            $scope.populateGroup(group);
                        }
                    });
                    $timeout(function () {
                        $scope.userAssigned = false;
                    }, 4000);
                }
            )
        };

        $scope.clearChosenUser = function () {
            $scope.chosenUser = null;
            $('input#cu').focus();
        };

        $scope.removeUserFromGroup = function (user) {
            Person.removeUserFromGroup(
                user.Identifier,
                user.Membership.Role,
                $scope.selectedGroup.Identifier,
                function () {
                    console.log("user removed");
                    _.each($scope.groupList, function (group) {
                        if (group.Identifier === $scope.selectedGroup.Identifier) {
                            $scope.populateGroup(group);
                        }
                    });
                }
            )
        };

    }
);