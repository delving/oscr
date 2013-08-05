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

var CultureCollectorApp = angular.module('CultureCollectorApp');

CultureCollectorApp.controller('LoginController',
    [
        '$rootScope', '$scope', '$location', 'Commons',
        function ($rootScope, $scope, $location, Commons) {

            $scope.username = '';
            $scope.password = '';

            $rootScope.login = function () {
                if ($scope.username && $scope.username.length) {
                    Commons.authenticate($scope.username, $scope.password, function(user) {
                        $rootScope.user = user;
                    });
                }
                if (!$rootScope.user) {
                    $rootScope.user = {
                        firstName: 'Oscr',
                        lastName: 'Wild',
                        email: 'oscr@delving.eu'
                    };
                }
                $location.path('/dashboard');
            };

            $rootScope.logout = function () {
                delete $rootScope.user;
                $location.path('/login');
            };
        }
    ]
);