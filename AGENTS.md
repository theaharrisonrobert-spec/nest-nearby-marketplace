<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep the account-page visual shell in AuthScene and authentication actions in the auth route so presentation changes do not alter verification or sign-in behavior.
- Reuse SiteHeader for shared navigation and account menus to keep session and verification indicators consistent across pages.
- Keep registration, category, publishing and promotion eligibility in marketplace-rules with concrete tests; enforce ownership and publishing eligibility in database policies too.
- Promotion requests are owner-scoped listing flags reviewed by admins; sponsorship is activated manually only after payment is confirmed, because checkout pricing is not configured.
- Listing phone and address columns are not readable by anon/authenticated (column-level grants); owners and admins read them only via listing_private_details, and the public via listing_address when show_address is on — keep new listing columns explicitly granted.
