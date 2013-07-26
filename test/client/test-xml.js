'use strict';

describe('XML Operations', function () {

    var xmlString =
        '<PhotoObject>' +
            '    <IdentificationNumber></IdentificationNumber>' +
            '    <Title>{ "multiple": true }</Title>' +
            '    <Type>' +
            '        <FirstPart/>' +
            '        <SecondPart/>' +
            '    </Type>' +
            '</PhotoObject>';

    var expectedEmpty =
    {
        name: 'PhotoObject',
        elements: [
            {
                name: 'IdentificationNumber',
                textInput: {}
            },
            {
                name: 'Title',
                valueExpression: {"multiple": true},
                textInput: {},
                multiple: true
            },
            {
                name: 'Type',
                elements: [
                    {
                        name: 'FirstPart',
                        textInput: {}
                    },
                    {
                        name: 'SecondPart',
                        textInput: {}
                    }
                ]
            }
        ]
    };

    var expectedClean =
    {
        PhotoObject: {
            IdentificationNumber: 'one',
            Title: ['two'],
            Type: {
                FirstPart: 'threeA',
                SecondPart: 'threeB'
            }
        }
    };

    var expectedXml =
        '<PhotoObject>' +
            '   <IdentificationNumber>one</IdentificationNumber>' +
            '   <Title>two</Title>' +
            '   <Type>' +
            '      <FirstPart>threeA</FirstPart>' +
            '      <SecondPart>threeB</SecondPart>' +
            '   </Type>' +
            '</PhotoObject>';

    it('should parse an xml document and generate', function () {
        var result = xmlToTree(xmlString);
        var jsonString = JSON.stringify(result);
        var expectedString = JSON.stringify(expectedEmpty);

//        console.log(expectedString);
//        console.log(jsonString);

        expect(jsonString).toBe(expectedString);

        result.elements[0].value = 'one';
        result.elements[1].value = 'two';
        result.elements[2].elements[0].value = 'threeA';
        result.elements[2].elements[1].value = 'threeB';

        var cleaned = treeToObject(result);

        var cleanedString = JSON.stringify(cleaned);
        var expectedCleanedString = JSON.stringify(expectedClean);
        expect(cleanedString).toBe(expectedCleanedString);
//        console.log(cleanedString);

        var xml = objectToXml(cleaned);
//        console.log(xml);
        expect(xml).toBe(expectedXml);
    });

    var xmlToBeObject =
        '<Language>' +
            '<label>' +
            '<EditExplanation>Edit field explanation</EditExplanation>' +
            '<Yes>Yes</Yes>' +
            '<New>New</New>' +
            '<ShowPreviews>Show previews</ShowPreviews>' +
            '<ShowTranslationEditor>Show translation editor</ShowTranslationEditor>' +
            '</label>' +
            '<element>' +
            '<IdentificationNumber><title>Identification Number</title></IdentificationNumber>' +
            '<Title><title>Title</title></Title>' +
            '<ShortDescription><title>Short description</title></ShortDescription>' +
            '</element>' +
            '</Language>';

    var expectedObject = {
        Language: {
            label: {
                EditExplanation: 'Edit field explanation',
                Yes: 'Yes',
                New: 'New',
                ShowPreviews: 'Show previews',
                ShowTranslationEditor: 'Show translation editor'
            },
            element: {
                IdentificationNumber: { title: "Identification Number" },
                Title: { title: "Title" },
                ShortDescription: { title: "Short description" }
            }
        }
    };

    it('should turn XML into a nice object', function () {
        var object = xmlToObject(xmlToBeObject);
        var resultString = JSON.stringify(object);
        var expectedString = JSON.stringify(expectedObject);
//        console.log(expectedString);
//        console.log(resultString);
        expect(resultString).toBe(expectedString);
    });


    var xmlToBeList =
        '<Entries>' +
            '<Entry>' +
            '<Label>One</Label>' +
            '<ID>1</ID>' +
            '</Entry>' +
            '</Entries>';

    var expectedList = [
        { Label: 'One', ID: '1'}
    ];

    it('should turn XML into a nice object', function () {
        var list = xmlToArray(xmlToBeList);
        var resultString = JSON.stringify(list);
        var expectedString = JSON.stringify(expectedList);
//        console.log(expectedString);
//        console.log(resultString);
        expect(resultString).toBe(expectedString);
    });

});
