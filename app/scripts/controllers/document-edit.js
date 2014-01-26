'use strict';

var OSCR = angular.module('OSCR');

// handle all things that show the tree, whether editing or viewing
OSCR.controller(
    'TreeController',
    function ($rootScope, $scope, $routeParams, $timeout, Document) {

        // the central scope elements
        $scope.tree = null;
        $scope.document = null;
        $scope.documentJSon = null; // todo: should be in edit controller

        // flags for view ()
        $scope.documentDirty = false; // todo: should be in edit controller
        $scope.saveSuccess = false; // todo: should be in edit controller

        // constants for triggering server-side substitutions
        $scope.blankIdentifier = '#IDENTIFIER#';
        $scope.blankTimeStamp = '#TIMESTAMP#';

        // things from the URL path
        $scope.schema = $routeParams.schema;
        $scope.groupIdentifier = $routeParams.groupIdentifier;
        $scope.identifier = $routeParams.identifier;

        // some things for display
        $scope.headerDisplay = '';
        $scope.groupName = $rootScope.getGroupName($scope.groupIdentifier);
        $scope.header = {};

        // re-internationalize the tree if the language changes
        $scope.$watch('i18n', function (i18n, oldValue) {
            if ($scope.tree && i18n) {
                i18nTree($scope.tree, i18n);
            }
        });

        // keep updating the time if there is a header
        function tick() {
            $timeout(
                function () {
                    if ($scope.header) {
                        $scope.time = updateTimeString($scope.header.TimeStamp);
                    }
                },
                15000
            ).then(tick);
        }
        tick();

        // run the validations in the tree's fields
        $scope.validateTree = function () {
            validateTree($scope.tree);
            if (!$scope.documentDirty) {
                if (!$scope.documentJSON) {
                    $scope.documentJSON = JSON.stringify(treeToObject($scope.tree), null, 4);
                }
                else {
                    var json = JSON.stringify(treeToObject($scope.tree), null, 4);
                    if ($scope.documentDirty = (json != $scope.documentJSON)) {
                        $scope.time = updateTimeString($scope.header.TimeStamp);
                    }
                }
            }
        };

        // if the document changes, we set up a new tree for it and populate the tree with it
        $scope.$watch('document', function (document, oldDocument) {
            if (!document) return;
            var emptyDocument = _.isString(document);
            // if document is a string, it's a schema name
            var schema = emptyDocument ? document : document.Header.SchemaName;
            if (!schema) {
                console.warn("Document header has no schema name");
                return;
            }
            Document.fetchSchema(schema, function (tree) {
                if (!tree) {
                    console.warn("No tree was returned for schema "+schema);
                    return;
                }
                $scope.tree = tree;
                if (!emptyDocument) {
                    populateTree(tree, document.Body);
                }
                installValidators(tree);
                validateTree(tree);
            });
        });

        // pressing the plus sign adds a sibling to the current parent
        $scope.addSiblingToParent = function (parentElement, childIndex) {
            var sibling = cloneAndPruneTree(parentElement.elements[childIndex]);
            parentElement.elements.splice(childIndex + 1, 0, sibling);
            return childIndex + 1; // the new position
        };

        // pressing the minus sign removes a child
        $scope.removeSiblingFromParent = function (parentElement, childIndex) {
            var list = parentElement.elements;
            var childName = list[childIndex].name;
            var hasSibling = false;
            if (childIndex > 0 && list[childIndex - 1].name == childName) {
                hasSibling = true;
            }
            if (childIndex < list.length - 1 && list[childIndex + 1].name == childName) {
                hasSibling = true;
            }
            if (hasSibling) {
                list.splice(childIndex, 1);
                if (childIndex >= list.length) {
                    childIndex--;
                }
            }
            return childIndex;
        };

        function getDocumentState(header) {
            if (header.DocumentState) {
                return header.DocumentState;
            }
            else {
                return $rootScope.defaultDocumentState($scope.schema);
            }
        }

        $scope.useHeader = function(header) {
            $scope.header.SchemaName = $scope.schema;
            $scope.header.Identifier = header.Identifier;
            $scope.header.GroupIdentifier = header.GroupIdentifier;
            $scope.header.SummaryFields = header.SummaryFields;
            $scope.header.DocumentState = getDocumentState(header);
            $scope.headerDisplay = header.Identifier === $scope.blankIdentifier ? null : header.Identifier;
            delete $scope.header.TimeStamp;
            var millis = parseInt(header.TimeStamp);
            if (!_.isNaN(millis)) {
                $scope.header.TimeStamp = millis;
            }
        };

        $scope.isDocumentPublic = function() {
            return getDocumentState($scope.header) == 'public';
        };

        // initialize, if there's an identifier we can fetch the document
        if ($scope.identifier) {
            Document.fetchDocument($scope.schema, $scope.groupIdentifier, $scope.identifier, function (document) {
                $scope.useHeader(document.Document.Header);
                $scope.documentDirty = false;
                $scope.document = document.Document; // triggers the editor
                $scope.addToRecentMenu(document.Document.Header); // reaches down to global.js
            });
        }
        else {
            $scope.useHeader({
                SchemaName: $scope.schema,
                GroupIdentifier: $rootScope.groupIdentifierForSave($scope.schema, $rootScope.user.groupIdentifier),
                Identifier: $scope.blankIdentifier
            });
            $scope.document = $scope.schema; // just a name triggers schema fetch
            $scope.documentDirty = false;
        }
    }
);

// just mind the tabs and their activation
OSCR.controller(
    'TabController',
    function ($rootScope, $scope) {

        $scope.activeTab = "novice";

        if($rootScope.user.viewer) {
            $scope.activeTab = "viewer";
        }

        // toggle tabs between edit and view
        $scope.isTabActive = function (tab) {
            return $scope.activeTab == tab;
        };

        // switch tabs
        $scope.setActiveTab = function(tab) {
            $scope.activeTab = tab;
        };

    }
);

// for the different kinds of tree editing, either panel or expert
OSCR.controller(
    'TreeEditController',
    function ($rootScope, $scope, $timeout, Document) {

        $rootScope.checkLoggedIn();

        // If the user has role:Viewer then don't show the doc edit form, but only the preview
        if ($rootScope.user.viewer) {
            // todo: they should not even see edit
            // todo: and viewer should be normal, editor should be special.  the boolean should give them permission.
            $scope.activeTab = "view";
        }

        $scope.chooseListPath = function() {
            $scope.documentList($scope.schema);
        };

        $scope.setDocumentState = function(state) {
            $scope.header.DocumentState = state;
            $scope.documentDirty = true;
        };

        $scope.saveDocument = function () {
            console.log("saveDocument", $scope.header);
            collectSummaryFields($scope.tree, $scope.header);
            $scope.header.TimeStamp = $scope.blankTimeStamp;
            $scope.header.SavedBy = $rootScope.user.Identifier;
            Document.saveDocument($scope.header, treeToObject($scope.tree), function (document) {
                $scope.useHeader(document.Header);
                $scope.documentDirty = false;
                $scope.saveSuccess = true;
                $timeout(function() {
                    $(".alert-saved").hide('slow');
                    $timeout(function(){
                        $scope.saveSuccess = false;
                    },250);
                }, 5000);
                $scope.choosePath(document.Header);
            });
        };

    }
);

// handle just the panel array way of editing the tree
OSCR.controller(
    'PanelArrayController',
    function ($rootScope, $scope, $timeout) {

        $scope.panels = [];
        $scope.focusElement = [];
        $scope.choice = 0;
        $scope.selectedPanelIndex = 0;

        // todo: should be a path up in the tree controller
        $scope.activeEl = undefined;

        $scope.$watch('tree', function (newTree, oldTree) {
            if (!newTree) return;
            $scope.panels = [
                { selected: 0, element: newTree }
            ];
            if (!$scope.annotationMode) {
                $scope.choose(0, 0);
            }
        });

        $scope.getFocusElement = function(el) {
            return $scope.focusElement[el.focusElementIndex];
        };

        $scope.setActiveEl = function (el) {
            $scope.activeEl = el;
            $timeout(function () {
                var fe = $scope.getFocusElement(el);
                if (fe) {
                    fe.focus();
                }
                else {
                    console.warn("no focus element for ");
                    console.log(el);
                }
            });
        };

        $scope.isActiveEl = function (el) {
            return $scope.activeEl === el;
        };

        $scope.valueChanged = function (el) {
//            console.log("value changed: active=" + (el == $scope.activeEl));
            $scope.validateTree();
        };

        $scope.choose = function (choice, panelIndex) {
//            $scope.choice = choice;
//            $scope.selectedPanelIndex = panelIndex;
            $scope.choice = choice;
            $scope.selectedPanelIndex = panelIndex;
            var parentPanel = $scope.panels[panelIndex];
            parentPanel.selected = choice;
            var chosen = parentPanel.element.elements[choice];
            parentPanel.element.elements.forEach(function (el) {
                el.classIndex = panelIndex;
                if (el === chosen) {
                    el.classIndex++;
                }
            });
            var childPanel = $scope.panels[panelIndex + 1] = {
                selected: 0,
                element: chosen
            };
            if (chosen.elements) {
                chosen.elements.forEach(function (el) {
                    el.classIndex = panelIndex + 1;
                });
            }
            $scope.panels.splice(panelIndex + 2, 5);

            // slide panels over
            var scroller = $('#panel-container'),
                table = $('#panel-table'),
                wTable = table.width(),
                leftPos = scroller.scrollLeft();

            scroller.animate({scrollLeft: leftPos + wTable}, 800);

//            if ($scope.setChoice) {
//                $scope.setChoice(childPanel.element);
//            }
            $scope.setActiveEl(chosen);
        };

        $scope.addSibling = function (element, index, panelIndex) {
            var indexToChoose = $scope.addSiblingToParent(element, index);
            $scope.choose(indexToChoose, panelIndex)
        };

        $scope.removeSibling = function (element, index, panelIndex) {
            var indexToChoose = $scope.removeSiblingFromParent(element, index);
            $scope.choose(indexToChoose, panelIndex);
        };

        $scope.getPanelEditTemplate = function (el) {
            if (el.elements) return "panel-submenu.html";
            if (el.config.line) return "panel-line.html";
            if (el.config.paragraph) return "panel-paragraph.html";
            if (el.config.vocabulary) return "panel-vocabulary.html";
            if (el.config.media) return "panel-media.html";
            return "panel-unrecognized.html"
        };

        $scope.getDetailView = function (el) {
            if (!el) {
//                console.warn("get detail view of nothing"); todo take care of this
                return "panel-field-documentation.html";
            }
            if (el.searching) {
                if (el.config.media) {
                    return "panel-media-search.html";
                }
                else if (el.config.vocabulary) {
                    return "panel-vocabulary-search.html";
                }
            }
            return "panel-field-documentation.html"
        };
    }
);

// a single element within a panel, editing and some keyboard navigation
OSCR.controller(
    'PanelElementController',
    function ($scope, $timeout) {

        $scope.el = $scope.element;

        $scope.enableEditor = function () {
            $scope.setActiveEl($scope.el);
        };

        $scope.navigationKeyPressed = function (key) {
            if ($scope.annotationMode) return; // is there maybe a better way?
            var elements = $scope.panels[$scope.selectedPanelIndex].element.elements;
            if (!elements) return;
            var size = elements.length;
            switch (key) {
                case 'up':
//                    $scope.disableEditor();
                    $scope.choose(($scope.choice + size - 1) % size, $scope.selectedPanelIndex);
                    break;
                case 'down':
//                    $scope.disableEditor();
                    $scope.choose(($scope.choice + 1) % size, $scope.selectedPanelIndex);
                    break;
                case 'right':
                    if ($scope.panels[$scope.selectedPanelIndex + 1].element.elements) {
                        $scope.choose(0, $scope.selectedPanelIndex + 1);
                    }
                    else {
                        $scope.enableEditor();
                    }
                    break;
                case 'left':
                    if ($scope.selectedPanelIndex > 0 && $scope.active == 'hidden') {
                        $scope.choose($scope.panels[$scope.selectedPanelIndex - 1].selected, $scope.selectedPanelIndex - 1);
                    }
                    break;
                case 'enter': // todo: enter did nothing in schema-changes
//                    if (!$scope.el.elements) {
//                        $scope.enableEditor();
//                    }
                    break;
            }
        };
    }
);


OSCR.directive('documentNavigation', function () {
    return {
        restrict: 'A',
        link: function (scope, elem, attr, ctrl) {
            elem.bind('keydown', function (e) {
                _.each([
                    { code: 37, name: 'left'},
                    { code: 39, name: 'right'},
                    { code: 38, name: 'up'},
                    { code: 40, name: 'down'},
                    { code: 13, name: 'enter'},
                    { code: 27, name: 'escape'}
                ], function (pair) {
                    if (pair.code === e.keyCode) {
                        scope.$apply(function (s) {
                            s.$eval(attr.documentNavigation, { $key: pair.name });
                        });
                    }
                });
            });
        }
    };
});

// the controller for viewing the tree only, not editing.  separates media from non-media.
OSCR.controller(
    'ViewTreeController',
    function ($scope) {

        // collect an array of only the media elements
        $scope.$watch("tree", function(tree, oldTree) {
            $scope.mediaElements = tree ? collectMediaElements(tree) : [];
        });

        $scope.mediaThumbnails = function() {
            return _.map($scope.mediaElements, function(el){
                console.log("return something from here", el);
                return el;
            });
        };

        $scope.filterNonMedia = function(elementList) {
            return _.filter(elementList, function(element) {
                return !element.config.media;
            });
        };

        $scope.hasValue = function(el) {
            return hasContent(el);
        };

    }
);

OSCR.controller(
    'ViewElementController',
    function ($scope) {

        $scope.getViewTemplate = function (el) {
            if (el.elements) return "view-submenu.html";
            if (el.config.line) return "view-line.html";
            if (el.config.paragraph) return "view-paragraph.html";
            if (el.config.vocabulary) return "view-vocabulary.html";
            if (el.config.media) return "view-media.html";
            return "view-unrecognized.html"
        };

        
    }
    
    
);

// the controller for the expert editing of the whole tree in view
OSCR.controller(
    'ExpertTreeController',
    function ($rootScope, $scope, $timeout, Document) {

        $scope.focusPath = [];

        $scope.getFocusElement = function(el) {
            return $scope.focusElement[el.focusElementIndex];
        };

        $scope.setActiveEl = function (el) {
            $scope.activeEl = el;
            $timeout(function () {
                var fe = $scope.getFocusElement(el);
                if (fe) {
                    fe.focus();
                }
                else {
                    console.warn("no focus element for ");
                    console.log(el);
                }
            });
        };

        $scope.isActiveEl = function (el) {
            return $scope.activeEl === el;
        };

        $scope.valueChanged = function (el) {
//            console.log("value changed: active=" + (el == $scope.activeEl));
            $scope.validateTree();
        };

        $scope.addSibling = function (list, index, panelIndex) {
            console.warn('not implemented'); // todo: call the tree controller
        };

        $scope.removeSibling = function (list, index, panelIndex) {
            console.warn('not implemented'); // todo: call the tree controller
        };

        $scope.getExpertEditTemplate = function (el) {
            if (el.elements) return "expert-submenu.html";
            if (el.config.line) return "expert-line.html";
            if (el.config.paragraph) return "expert-paragraph.html";
            if (el.config.vocabulary) return "expert-vocabulary.html";
            if (el.config.media) return "expert-media.html";
            return "expert-unrecognized.html"
        };

        $scope.getDetailTemplate = function (el) {
            if (!el) {
//                console.warn("get detail template of nothing"); // todo take care of this
                return "expert-field-documentation.html"
            }
            if (el.searching) {
                if (el.config.media) {
                    return "expert-media-search.html";
                }
                else if (el.config.vocabulary) {
                    return "expert-vocabulary-search.html";
                }
            }
            return "expert-field-documentation.html"
        };

    }
);

OSCR.controller(
    'ExpertElementController',
    function ($scope, $timeout) {

        $scope.el = $scope.element;

        $scope.enableEditor = function () {
            $scope.setActiveEl($scope.el);
        };

    }
);

OSCR.directive('elFocus',
    function () {
        return {
            restrict: 'A',
            priority: 100,
            scope: {
                el: "=elFocus",
                focusElement: "=elFocusElement"
            },
            link: function ($scope, $element) {
                if (!$scope.focusElement) {
//                    console.warn("elFocus no focus $element");  // todo: look into this
                    return;
                }
                $scope.el.focusElementIndex = $scope.focusElement.length;
                $scope.focusElement.push($element[0]);
            }
        };
    }
);

// todo: this is deprecated
OSCR.directive('focus',
    function ($timeout) {
        return {
            restrict: 'A',
            priority: 100,
            link: function (scope, element, attrs) {
                scope.$watch('active', function(active) {
                    if (attrs.id === active && (attrs.id == 'hidden')) {
                        $timeout(function () {
                            element[0].focus();
                        });
                    }
                });
            }
        };
    }
);


