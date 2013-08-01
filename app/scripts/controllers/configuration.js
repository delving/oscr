'use strict';

var CultureCollectorApp = angular.module('CultureCollectorApp');

CultureCollectorApp.controller('ConfigurationController',
    ['$rootScope',
        function ($rootScope) {

            $rootScope.config = {
                interfaceLanguages: [
                    {name: 'English', code: 'en'},
                    {name: 'Nederlands', code: 'nl'}
                ],
                interfaceLanguage: 'en',
                showInlinePreview: true,
                showTranslationEditor: false
            };

            $rootScope.toggleInlinePreview = function () {
                if ($rootScope.translating()) return;
                $rootScope.config.showInlinePreview = !$rootScope.config.showInlinePreview;
            };

            $rootScope.toggleTranslationEditor = function () {
                $rootScope.config.showTranslationEditor = !$rootScope.config.showTranslationEditor;
            };

            $rootScope.translating = function () {
                return $rootScope.config.showTranslationEditor;
            }

        }]);