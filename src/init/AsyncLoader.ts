import { connect } from 'react-redux';
import { ActionCreators } from '../state/reducer';
import { base64ToBin, binToUtf8 } from '@bitauth/libauth';
import { inflate } from 'pako';
import { ideImportAuthenticationTemplate } from '../state/import-export';
import { getRoute, Routes } from './routing';

const clearRoute = () => window.history.pushState(null, 'Bitauth IDE', '/');

export const AsyncLoader = connect(() => ({}), {
  attemptInvalidImport: ActionCreators.attemptInvalidImport,
  importTemplate: ActionCreators.importTemplate,
  openTemplateSettings: ActionCreators.openTemplateSettings,
  openWelcomePane: ActionCreators.openWelcomePane,
  openGuide: ActionCreators.openGuide,
})(
  ({
    attemptInvalidImport,
    importTemplate,
    openTemplateSettings,
    openWelcomePane,
    openGuide,
  }: {
    attemptInvalidImport: typeof ActionCreators.attemptInvalidImport;
    importTemplate: typeof ActionCreators.importTemplate;
    openTemplateSettings: typeof ActionCreators.openTemplateSettings;
    openWelcomePane: typeof ActionCreators.openWelcomePane;
    openGuide: typeof ActionCreators.openGuide;
  }) => {
    const supportsBigInt = typeof BigInt !== 'undefined';
    if (!supportsBigInt) {
      return null;
    }

    const howToResolve = `The invalid template will now be shown in the import dialog: you can manually edit the JSON to correct any validation errors, then import the template. If you have trouble, let us know in the community chat, we're happy to help!`;

    const route = getRoute();
    if (route) {
      const payload = window.location.pathname.slice(route.length + 2);
      if (route === Routes.directImport) {
        const base64UrlToBase64 = (base64: string) =>
          base64.replace(/-/g, '+').replace(/_/g, '/');
        try {
          console.log('Importing from payload:', payload);
          const uncompressed = binToUtf8(
            inflate(base64ToBin(base64UrlToBase64(payload)))
          );
          const parsed = JSON.parse(uncompressed);
          const importedTemplate = ideImportAuthenticationTemplate(parsed);
          if (typeof importedTemplate === 'string') {
            const error = `This link may have been created manually or with an outdated version of Bitauth IDE: the link is valid, but the authentication template it encodes is not.\n\n${howToResolve}`;
            window.alert(error);
            console.error(error);
            attemptInvalidImport(uncompressed);
            return null;
          }
          setTimeout(() => {
            importTemplate(importedTemplate);
            openTemplateSettings();
          }, 0);
        } catch (e) {
          window.alert(
            'This sharing URL seems to be corrupted. Please check the link and try again.'
          );
          console.error(e);
          setTimeout(() => {
            openWelcomePane();
          }, 0);
        }
        clearRoute();
      } else if (route === Routes.gistImport) {
        const gistUrl = `https://gist.github.com/${payload}`;
        const gistApiUrl = `https://api.github.com/gists/${payload}`;
        setTimeout(async () => {
          fetch(gistApiUrl)
            .then((results) => {
              return results.json();
            })
            .then((data) => {
              try {
                if (typeof data.files !== 'object' || data.files === null) {
                  throw new Error(
                    `Could not find Gist. Please check the URL and try again.`
                  );
                }
                const firstFile = Object.entries(data.files).find(
                  ([filename]) => filename.slice(-5) === '.json'
                );
                if (!firstFile) {
                  throw new Error(
                    `No file ending in '.json' found – please confirm the Gist has a valid authentication template in JSON format.`
                  );
                }
                const filename = firstFile[0];
                const file = firstFile[1];
                if (
                  typeof file !== 'object' ||
                  file === null ||
                  typeof (file as { content: string }).content !== 'string'
                ) {
                  throw new Error(
                    `Unexpected response from GitHub, returned file (${filename}) contents: ${file}`
                  );
                }
                const content = (file as { content: string }).content;
                console.log(
                  `Importing '${filename}' from ${gistUrl} as an authentication template.`
                );
                const parsed = JSON.parse(content);
                const template = ideImportAuthenticationTemplate(parsed);
                if (typeof template === 'string') {
                  const error = `There is a problem with the imported GitHub Gist: this authentication template has validation errors. It may have been created manually or with an outdated version of Bitauth IDE.\n\n${howToResolve}`;
                  window.alert(error);
                  console.error(error);
                  attemptInvalidImport(content);
                  return null;
                }
                importTemplate(template);
                openTemplateSettings();
              } catch (e) {
                const error = `There was a problem importing the template from the GitHub Gist (${gistUrl}): ${e}`;
                window.alert(error);
                console.error(error);
                openWelcomePane();
              }
            })
            .catch((e) => {
              const error = `There was a problem fetching the Gist (${gistApiUrl}) from GitHub. Please check the link and try again. ${e}`;
              window.alert(error);
              console.error(error);
              openWelcomePane();
            });
        }, 0);
      } else if (route === Routes.guide) {
        openGuide();
      } else {
        console.log('Cleared unknown route:', route);
      }
      clearRoute();
    }

    return null;
  }
);
