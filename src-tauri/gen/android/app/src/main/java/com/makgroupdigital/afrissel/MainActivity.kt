package com.makgroupdigital.afrissel

import android.app.Activity
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.enableEdgeToEdge
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.ApiException
import org.json.JSONObject

class MainActivity : TauriActivity() {
  private var afriSellWebView: WebView? = null
  private var googleAuthRequestId: String = ""

  private val googleSignInLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
    if (result.resultCode != Activity.RESULT_OK) {
      dispatchGoogleAuthResult(
        JSONObject()
          .put("requestId", googleAuthRequestId)
          .put("error", "Connexion Google annulée.")
      )
      return@registerForActivityResult
    }

    val task = GoogleSignIn.getSignedInAccountFromIntent(result.data)
    try {
      val account = task.getResult(ApiException::class.java)
      val idToken = account.idToken
      if (idToken.isNullOrBlank()) {
        dispatchGoogleAuthResult(
          JSONObject()
            .put("requestId", googleAuthRequestId)
            .put("error", "Google Android n’a pas retourné de jeton sécurisé.")
        )
        return@registerForActivityResult
      }

      dispatchGoogleAuthResult(
        JSONObject()
          .put("requestId", googleAuthRequestId)
          .put("idToken", idToken)
          .put("email", account.email ?: "")
          .put("displayName", account.displayName ?: "")
          .put("photoUrl", account.photoUrl?.toString() ?: "")
      )
    } catch (error: ApiException) {
      dispatchGoogleAuthResult(
        JSONObject()
          .put("requestId", googleAuthRequestId)
          .put("error", "Connexion Google Android impossible (${error.statusCode}).")
      )
    }
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
  }

  override fun onWebViewCreate(webView: WebView) {
    super.onWebViewCreate(webView)
    afriSellWebView = webView
    webView.addJavascriptInterface(AfriZiaNativeAuthBridge(), "AfriZiaNativeAuth")
  }

  inner class AfriZiaNativeAuthBridge {
    @JavascriptInterface
    fun signInWithGoogle(requestId: String, webClientId: String) {
      runOnUiThread {
        googleAuthRequestId = requestId

        if (webClientId.isBlank()) {
          dispatchGoogleAuthResult(
            JSONObject()
              .put("requestId", requestId)
              .put("error", "Client Google Android manquant. Configure VITE_GOOGLE_WEB_CLIENT_ID.")
          )
          return@runOnUiThread
        }

        val options = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
          .requestIdToken(webClientId)
          .requestEmail()
          .requestProfile()
          .build()
        val client = GoogleSignIn.getClient(this@MainActivity, options)

        client.signOut().addOnCompleteListener {
          googleSignInLauncher.launch(client.signInIntent)
        }
      }
    }
  }

  private fun dispatchGoogleAuthResult(payload: JSONObject) {
    val script = "window.dispatchEvent(new CustomEvent('afrisell:native-auth-result',{detail:${payload}}));"
    afriSellWebView?.post {
      afriSellWebView?.evaluateJavascript(script, null)
    }
  }
}
