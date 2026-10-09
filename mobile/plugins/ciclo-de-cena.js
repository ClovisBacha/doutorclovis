/**
 * O CICLO DE VIDA POR CENA, que o iOS 27 passou a exigir.
 *
 * O primeiro build no TestFlight abria e fechava no mesmo instante. O
 * relatório de travamento do iPhone (iOS 27.0.1) parava em
 * `_UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption`: app
 * compilado com o SDK do iOS 27 que não adota `UIScene` é derrubado na
 * abertura. O modelo de projeto do Expo 57 ainda cria a janela no
 * AppDelegate, à moda antiga; o Expo 58 (React Native 0.88, ainda RC) já vem
 * com cena.
 *
 * O runtime do Expo 57 já traz as peças (`ExpoAppSceneDelegate` e
 * `ExpoReactNativeFactoryProvider`); só o modelo não as usa. Este plugin faz
 * o projeto gerado ficar igual ao modelo do Expo 58:
 *   1. o AppDelegate deixa de criar a janela e passa a entregar a fábrica do
 *      React Native ao delegate de cena;
 *   2. nasce o `SceneDelegate.swift` (subclasse vazia de ExpoAppSceneDelegate);
 *   3. o Info.plist declara a cena.
 *
 * Idempotente: o `prebuild` sem `--clean` roda os mods de novo sobre o projeto
 * que já existe. E falha alto se o AppDelegate vier num formato que ele não
 * reconhece — um app que abre e fecha é pior do que um prebuild que para.
 * Quando o app for para o Expo 58, este plugin sai.
 */
const fs = require("fs");
const path = require("path");
const {
  IOSConfig,
  withAppDelegate,
  withInfoPlist,
  withXcodeProject,
} = require("expo/config-plugins");

const MARCA = "SceneDelegate` under the scene-based life cycle";

const JANELA_ANTIGA =
  /\n#if os\(iOS\) \|\| os\(tvOS\)\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\n\s*factory\.startReactNative\(\n\s*withModuleName: "main",\n\s*in: window,\n\s*launchOptions: launchOptions\)\n#endif\n/;

const CLASSE_ANTIGA = "class AppDelegate: ExpoAppDelegate {";
const CLASSE_NOVA = "class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {";

const SCENE_DELEGATE = `internal import Expo

@objc(SceneDelegate)
class SceneDelegate: ExpoAppSceneDelegate {
  // Extension point for config plugins.
}
`;

function comAppDelegateDeCena(config) {
  return withAppDelegate(config, (c) => {
    if (c.modResults.language !== "swift") {
      throw new Error("ciclo-de-cena: o AppDelegate não é Swift; o plugin não sabe adaptá-lo.");
    }
    let s = c.modResults.contents;

    if (!s.includes(CLASSE_NOVA)) {
      if (!s.includes(CLASSE_ANTIGA)) {
        throw new Error("ciclo-de-cena: não achei `class AppDelegate: ExpoAppDelegate {`.");
      }
      s = s.replace(CLASSE_ANTIGA, CLASSE_NOVA);
    }

    if (!s.includes(MARCA)) {
      if (!JANELA_ANTIGA.test(s)) {
        throw new Error("ciclo-de-cena: não achei o bloco que cria a janela no AppDelegate.");
      }
      s = s.replace(
        JANELA_ANTIGA,
        "\n    // The window is created and React Native is started by `" +
          MARCA +
          "\n    // (required by the iOS 27 SDK).\n",
      );
    }

    c.modResults.contents = s;
    return c;
  });
}

function comSceneDelegate(config) {
  return withXcodeProject(config, (c) => {
    const projeto = c.modResults;
    const nome = IOSConfig.XcodeUtils.getProjectName(c.modRequest.projectRoot);
    const relativo = `${nome}/SceneDelegate.swift`;
    fs.writeFileSync(path.join(c.modRequest.platformProjectRoot, relativo), SCENE_DELEGATE);
    if (!projeto.hasFile(relativo)) {
      IOSConfig.XcodeUtils.addBuildSourceFileToGroup({
        filepath: relativo,
        groupName: nome,
        project: projeto,
      });
    }
    return c;
  });
}

function comCenaNoInfoPlist(config) {
  return withInfoPlist(config, (c) => {
    c.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: "Default Configuration",
            UISceneDelegateClassName: "$(PRODUCT_MODULE_NAME).SceneDelegate",
          },
        ],
      },
    };
    return c;
  });
}

module.exports = function cicloDeCena(config) {
  return comCenaNoInfoPlist(comSceneDelegate(comAppDelegateDeCena(config)));
};
