using Implem.Pleasanter.Libraries.Requests;

namespace Implem.Pleasanter.Libraries.Settings
{
    public class Text
    {
        public int Id;
        public string LabelText;
        public bool? Hide;

        public Text GetRecordingData(SiteSettings ss)
        {
            return new Text
            {
                Id = Id,
                LabelText = LabelText,
                Hide = Hide
            };
        }

        public void SetByForm(Context context, SiteSettings ss)
        {
            foreach (var controlId in context.Forms.Keys)
            {
                switch (controlId)
                {
                    case "LabelText":
                        LabelText = context.Forms.Data(controlId);
                        break;
                }
            }
        }

        public void Update(
            int id,
            string labelText,
            bool? hide)
        {
            Id = id;
            if (labelText != null) LabelText = labelText;
            if (hide != null) Hide = hide;
        }
    }
}
