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
    'GroupViewController',
    function ($rootScope, $scope, $routeParams, $location, $cookieStore, Person) {
        $scope.Identifier = $routeParams.identifier;

        Person.getGroup($scope.Identifier, function(group) {
            $scope.groupView = group.Group;
            Person.getUsersInGroup($scope.Identifier, function (list) {
                _.each(list, function (user) {
                    if (user.Memberships) {
                        _.each(xmlArray(user.Memberships.Membership), function (membership) {
                            if (membership.GroupIdentifier === group.Identifier) {
                                user.GroupMember = membership;
                            }
                        });
                    }
                });
                $scope.groupView.userList = list;
            });

        });
    }
);
